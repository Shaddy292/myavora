import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import PromoRedemptionSummary from "@/components/avora/admin/PromoRedemptionSummary";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { deletePromoCode, promoCodeBoard, savePromoCode, setPromoActive } from "@/lib/platform-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/promo-codes")({
  loader: async () => {
    const context = await getConsoleContext();
    const [board, stores] = await Promise.all([
      promoCodeBoard(),
      db.entities.Store.filter({ is_approved: true }, { sort: "name", limit: 100 }),
    ]);
    return { context, board, stores: stores.items ?? stores };
  },
  head: () => ({ meta: [{ title: "Promo codes · AVORA admin" }] }),
  component: PromoCodes,
});

const BLANK = {
  id: "",
  code: "",
  description: "",
  discount_type: "percent",
  value: "10",
  min_order: "0",
  max_discount: "0",
  usage_limit: "0",
  expires_at: "",
  is_active: true,
  store_id: "",
};

function PromoCodes() {
  const { context, board, stores } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(savePromoCode);
  const toggle = useServerFn(setPromoActive);
  const drop = useServerFn(deletePromoCode);
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  if (!board.admin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="promos" badge="Operations" title="Promo codes" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          id: draft.id || undefined,
          code: draft.code,
          description: draft.description,
          discount_type: draft.discount_type,
          value: Number(draft.value) || 0,
          min_order: Number(draft.min_order) || 0,
          max_discount: Number(draft.max_discount) || 0,
          usage_limit: Number(draft.usage_limit) || 0,
          expires_at: draft.expires_at,
          is_active: draft.is_active,
          store_id: draft.store_id,
        },
      });
      toast.success(draft.id ? "Promo code updated" : `Code ${draft.code.toUpperCase()} created`);
      setDraft(BLANK);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save this code");
    } finally {
      setBusy(false);
    }
  };

  const changeActive = async (promo) => {
    try {
      await toggle({ data: { id: promo.id, is_active: !promo.is_active } });
      toast.success(promo.is_active ? `${promo.code} paused` : `${promo.code} is live`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this code");
    }
  };

  const remove = async (promo) => {
    try {
      await drop({ data: { id: promo.id } });
      toast.success(`${promo.code} deleted`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not delete this code");
    }
  };

  const edit = (promo) =>
    setDraft({
      id: promo.id,
      code: promo.code ?? "",
      description: promo.description ?? "",
      discount_type: promo.discount_type ?? "percent",
      value: String(promo.value ?? 0),
      min_order: String(promo.min_order ?? 0),
      max_discount: String(promo.max_discount ?? 0),
      usage_limit: String(promo.usage_limit ?? 0),
      expires_at: promo.expires_at ? String(promo.expires_at).slice(0, 10) : "",
      is_active: promo.is_active !== false,
      store_id: promo.store_id ?? "",
    });

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="promos"
      badge="Operations"
      title="Promo codes"
      subtitle={`${board.codes.length} codes · ${board.codes.filter((code) => code.is_active !== false).length} live`}
      role={context.role}
    >
      <PromoRedemptionSummary codes={board.codes} />

      <form onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
          <Tag className="h-4 w-4 text-[#4B2080]" /> {draft.id ? "Edit promo code" : "Create a promo code"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input
            required
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
            placeholder="Code (AVORA10)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] font-semibold uppercase outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Description (Weekend treat)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <FieldSelect
            value={draft.discount_type}
            onChange={(value) => setDraft({ ...draft, discount_type: value })}
            options={[
              { value: "percent", label: "Percentage off" },
              { value: "fixed", label: "Fixed amount off" },
            ]}
            className="mt-0"
          />
          <input
            required
            type="number"
            min="0"
            value={draft.value}
            onChange={(event) => setDraft({ ...draft, value: event.target.value })}
            placeholder={draft.discount_type === "percent" ? "Percent (10)" : "Amount (₦)"}
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="number"
            min="0"
            value={draft.min_order}
            onChange={(event) => setDraft({ ...draft, min_order: event.target.value })}
            placeholder="Minimum order (₦)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="number"
            min="0"
            value={draft.max_discount}
            onChange={(event) => setDraft({ ...draft, max_discount: event.target.value })}
            placeholder="Max discount (₦, 0 = none)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="number"
            min="0"
            value={draft.usage_limit}
            onChange={(event) => setDraft({ ...draft, usage_limit: event.target.value })}
            placeholder="Usage limit (0 = unlimited)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="date"
            value={draft.expires_at}
            onChange={(event) => setDraft({ ...draft, expires_at: event.target.value })}
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] text-[#5B4A6B] outline-none focus:border-[#4B2080]"
            aria-label="Expiry date"
          />
          <FieldSelect
            value={draft.store_id || "all"}
            onChange={(value) => setDraft({ ...draft, store_id: value === "all" ? "" : value })}
            options={[
              { value: "all", label: "All stores" },
              ...stores.map((store) => ({ value: store.id, label: store.name })),
            ]}
            className="mt-0"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> {busy ? "Saving…" : draft.id ? "Save changes" : "Create code"}
          </button>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#5B4A6B]">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
              className="accent-[#4B2080]"
            />
            Live at checkout
          </label>
          {draft.id && (
            <button
              type="button"
              onClick={() => setDraft(BLANK)}
              className="text-[12px] font-bold text-[#8B7A9C] hover:text-[#2B0B4D]"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {board.codes.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No promo codes yet" description="Create your first code above — customers apply it at checkout." />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {board.codes.map((promo) => (
              <li key={promo.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-bold text-[#1B1024]">
                    {promo.code}
                    <span className="rounded-full bg-[#F3ECFB] px-2 py-0.5 text-[10.5px] font-bold text-[#4B2080]">
                      {promo.discount_type === "fixed" ? formatNGN(promo.value) : `${promo.value}%`}
                    </span>
                  </p>
                  <p className="truncate text-[11.5px] text-[#9A8CA8]">
                    {promo.description || "No description"}
                    {promo.min_order ? ` · min ${formatNGN(promo.min_order)}` : ""}
                    {promo.expires_at ? ` · expires ${String(promo.expires_at).slice(0, 10)}` : ""}
                  </p>
                </div>
                <span className="text-[11.5px] text-[#8B7A9C]">
                  used {promo.used_count || 0}
                  {promo.usage_limit ? ` / ${promo.usage_limit}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => changeActive(promo)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                    promo.is_active !== false ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FDECEC] text-[#A11D1D]"
                  )}
                >
                  {promo.is_active !== false ? "Live" : "Paused"}
                </button>
                <button
                  type="button"
                  onClick={() => edit(promo)}
                  className="text-[#8B7A9C] transition hover:text-[#2B0B4D]"
                  aria-label={`Edit ${promo.code}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(promo)}
                  className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Delete ${promo.code}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}