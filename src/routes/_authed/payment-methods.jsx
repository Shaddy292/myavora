import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { cn } from "@/lib/utils";
import { Banknote, CreditCard, Plus, ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/payment-methods")({
  loader: async () => {
    const [me, cards] = await Promise.all([
      db.auth.me(),
      db.entities.PaymentMethod.list("-created_date", 20),
    ]);
    return { me, cards };
  },
  head: () => ({ meta: [{ title: "Payment methods · AVORA" }] }),
  component: PaymentMethods,
});

const BRANDS = ["visa", "mastercard", "verve", "amex", "other"];
const BLANK = { label: "", brand: "visa", last4: "", exp_month: "", exp_year: "", holder: "" };

function PaymentMethods() {
  const { me, cards } = Route.useLoaderData();
  const router = useRouter();
  const [preference, setPreference] = useState(me.payment_preference || "cash");
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const savePreference = async (value) => {
    setPreference(value);
    try {
      await db.auth.updateMe({ payment_preference: value });
      toast.success(value === "cash" ? "Cash is now your default" : "Card is now your default");
    } catch (error) {
      toast.error(error?.message || "Could not save your preference");
    }
  };

  const addCard = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(draft.last4)) {
      toast.error("Enter the last 4 digits of the card");
      return;
    }
    setBusy(true);
    try {
      await db.entities.PaymentMethod.create({
        label: draft.label.trim() || `${draft.brand} •••• ${draft.last4}`,
        brand: draft.brand,
        last4: draft.last4,
        exp_month: Number(draft.exp_month) || undefined,
        exp_year: Number(draft.exp_year) || undefined,
        holder: draft.holder.trim(),
        is_default: cards.length === 0,
      });
      setDraft(BLANK);
      toast.success("Card reference saved");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save this card");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (card) => {
    try {
      await Promise.all([
        db.entities.PaymentMethod.update(card.id, { is_default: true }),
        ...cards
          .filter((row) => row.id !== card.id && row.is_default)
          .map((row) => db.entities.PaymentMethod.update(row.id, { is_default: false })),
      ]);
      toast.success(`${card.label} is now default`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the default card");
    }
  };

  const remove = async (card) => {
    try {
      await db.entities.PaymentMethod.delete(card.id);
      toast.success("Card removed");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not remove this card");
    }
  };

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Payment methods</h1>
      <p className="text-[13px] text-[#8B7A9C]">Choose how you pay and keep your cards on file for faster checkout.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Preferred payment</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { key: "cash", label: "Cash on delivery", hint: "Pay the rider at your door", icon: Banknote },
                { key: "card", label: "Card on delivery", hint: "Rider brings a POS", icon: CreditCard },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => savePreference(option.key)}
                  className={cn(
                    "flex items-start gap-2 rounded-xl px-3 py-2.5 text-left ring-1 transition",
                    preference === option.key ? "bg-[#F8F5FC] ring-[#4B2080]" : "bg-white ring-[#EFE7F6] hover:ring-[#D9C6EA]"
                  )}
                >
                  <option.icon className="mt-0.5 h-4 w-4 text-[#4B2080]" />
                  <span>
                    <span className="block text-[12.5px] font-bold text-[#1B1024]">{option.label}</span>
                    <span className="block text-[11.5px] text-[#9A8CA8]">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#9A8CA8]">
              This preference is pre-selected when you check out — you can still change it per order.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Cards on file</h2>
            {cards.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No cards saved" description="Add a card below so card payments are one tap at checkout." />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {cards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                    <span className="flex h-8 w-11 items-center justify-center rounded-md bg-[#2B0B4D] text-[9.5px] font-bold uppercase text-white">
                      {card.brand}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-[#1B1024]">
                        {card.label} · •••• {card.last4}
                      </p>
                      <p className="text-[11px] text-[#9A8CA8]">
                        {card.holder || me.full_name || me.email}
                        {card.exp_month && card.exp_year ? ` · expires ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}` : ""}
                      </p>
                    </div>
                    {card.is_default ? (
                      <span className="rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#15693F]">
                        Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeDefault(card)}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#3B0A66] ring-1 ring-[#EFE7F6] transition hover:bg-[#F4EEFA]"
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(card)}
                      className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                      aria-label={`Remove ${card.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <form onSubmit={addCard} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
              <Plus className="h-4 w-4 text-[#4B2080]" /> Add a card
            </h2>
            <div className="mt-3 space-y-2">
              <input
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                placeholder="Nickname (My GTB card)"
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
              <FieldSelect
                value={draft.brand}
                onChange={(value) => setDraft({ ...draft, brand: value })}
                options={BRANDS.map((brand) => ({ value: brand, label: brand }))}
                className="mt-0 h-10"
              />
              <input
                inputMode="numeric"
                maxLength={4}
                value={draft.last4}
                onChange={(event) => setDraft({ ...draft, last4: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="Last 4 digits"
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  inputMode="numeric"
                  maxLength={2}
                  value={draft.exp_month}
                  onChange={(event) => setDraft({ ...draft, exp_month: event.target.value.replace(/\D/g, "").slice(0, 2) })}
                  placeholder="MM"
                  className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
                />
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={draft.exp_year}
                  onChange={(event) => setDraft({ ...draft, exp_year: event.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="YYYY"
                  className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
                />
              </div>
              <input
                value={draft.holder}
                onChange={(event) => setDraft({ ...draft, holder: event.target.value })}
                placeholder="Name on card"
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save card"}
            </button>
          </form>

          <section className="rounded-2xl bg-[#F8F5FC] p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="flex items-center gap-1.5 font-display text-[13.5px] font-bold text-[#1B1024]">
              <ShieldCheck className="h-4 w-4 text-[#1F7A4C]" /> How your card details are handled
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[#8B7A9C]">
              We keep only the brand, last 4 digits and expiry so you can recognise a card. Full card numbers and CVVs are
              never stored here, and card payments are collected on delivery by the rider's POS.
            </p>
          </section>
        </div>
      </div>
    </CustomerShell>
  );
}