import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ImageUploadField from "@/components/avora/console/ImageUploadField";
import { CATEGORIES } from "@/lib/avora";
import { saveVendorStore } from "@/lib/vendor-fns";

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Storefront details editor for the vendor console. */
export default function StoreProfileForm({ store }) {
  const router = useRouter();
  const save = useServerFn(saveVendorStore);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    name: store.name ?? "",
    category: store.category ?? CATEGORIES[0].label,
    tagline: store.tagline ?? "",
    promo: store.promo ?? "",
    address: store.address ?? "",
    area: store.area ?? "",
    phone: store.phone ?? "",
    delivery_fee: store.delivery_fee ?? 500,
    min_order: store.min_order ?? 0,
    eta_min: store.eta_min ?? 20,
    eta_max: store.eta_max ?? 35,
    is_open: store.is_open !== false,
    logo_url: store.logo_url ?? "",
    cover_url: store.cover_url ?? ""
  });

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (draft.name.trim().length < 2) {
      toast.error("Give your store a name");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          ...draft,
          name: draft.name.trim(),
          delivery_fee: num(draft.delivery_fee),
          min_order: num(draft.min_order),
          eta_min: Math.max(1, num(draft.eta_min, 20)),
          eta_max: Math.max(num(draft.eta_min, 20), num(draft.eta_max, 35))
        }
      });
      toast.success("Store details saved");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save the store");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]";
  const label = "text-[11.5px] font-semibold text-[#5B4A6B]";

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Storefront</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={label}>Store name</span>
            <input value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={80} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Category</span>
            <select value={draft.category} onChange={(event) => set("category", event.target.value)} className={field}>
              {CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={label}>Tagline</span>
          <input value={draft.tagline} onChange={(event) => set("tagline", event.target.value)} maxLength={140} className={field} />
        </label>
        <label className="block space-y-1.5">
          <span className={label}>Promo badge</span>
          <input
            value={draft.promo}
            onChange={(event) => set("promo", event.target.value)}
            maxLength={80}
            placeholder="e.g. 20% off"
            className={field}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ImageUploadField label="Logo" value={draft.logo_url} onChange={(url) => set("logo_url", url)} />
          <ImageUploadField label="Cover photo" value={draft.cover_url} onChange={(url) => set("cover_url", url)} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Contact & delivery</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={label}>Address</span>
            <input value={draft.address} onChange={(event) => set("address", event.target.value)} maxLength={160} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Area</span>
            <input value={draft.area} onChange={(event) => set("area", event.target.value)} maxLength={80} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Phone</span>
            <input value={draft.phone} onChange={(event) => set("phone", event.target.value)} maxLength={40} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Delivery fee (₦)</span>
            <input
              type="number"
              min={0}
              value={draft.delivery_fee}
              onChange={(event) => set("delivery_fee", event.target.value)}
              className={field}
            />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Minimum order (₦)</span>
            <input
              type="number"
              min={0}
              value={draft.min_order}
              onChange={(event) => set("min_order", event.target.value)}
              className={field}
            />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Preparation time (min)</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={240}
                value={draft.eta_min}
                onChange={(event) => set("eta_min", event.target.value)}
                className={field}
              />
              <span className="text-[12px] text-[#8B7A9C]">to</span>
              <input
                type="number"
                min={1}
                max={240}
                value={draft.eta_max}
                onChange={(event) => set("eta_max", event.target.value)}
                className={field}
              />
            </div>
          </label>
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
          <input
            type="checkbox"
            checked={draft.is_open}
            onChange={(event) => set("is_open", event.target.checked)}
            className="h-4 w-4 accent-[#2B0B4D]"
          />
          <span className="text-[12.5px] font-semibold text-[#1B1024]">Accept new orders</span>
        </label>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save store details"}
      </button>
    </form>
  );
}
