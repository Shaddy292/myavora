import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import { previewPromo } from "@/lib/platform-fns";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { formatNGN } from "@/lib/avora";
import { clearCart, useCart } from "@/lib/cart";
import { placeOrder } from "@/lib/order-fns";
import { Banknote, CreditCard, MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/checkout")({
  loader: async () => {
    const addresses = await db.entities.Address.list("-created_date", 20);
    return { addresses };
  },
  head: () => ({ meta: [{ title: "Checkout · AVORA" }] }),
  component: Checkout,
});

function Checkout() {
  const { addresses } = Route.useLoaderData();
  const { items, subtotal, store, setQty, remove } = useCart();
  const navigate = useNavigate();
  const router = useRouter();
  const [addressId, setAddressId] = useState(
    addresses.find((row) => row.is_default)?.id ?? addresses[0]?.id ?? ""
  );
  const [showNew, setShowNew] = useState(addresses.length === 0);
  const [draft, setDraft] = useState({ label: "Home", line1: "", area: "", phone: "" });
  const [payment, setPayment] = useState("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const checkPromo = useServerFn(previewPromo);

  const deliveryFee = store?.fee ?? 0;
  const serviceFee = Math.round(subtotal * 0.05);
  const discount = promo?.discount ?? 0;
  const total = subtotal + deliveryFee + serviceFee - discount;

  const applyPromo = async () => {
    if (promoInput.trim().length < 2) {
      toast.error("Enter a promo code");
      return;
    }
    setPromoBusy(true);
    try {
      const result = await checkPromo({
        data: { code: promoInput.trim(), subtotal, store_id: store?.id },
      });
      setPromo(result);
      toast.success(`${result.code} applied · ${formatNGN(result.discount)} off`);
    } catch (error) {
      setPromo(null);
      toast.error(error?.message || "That promo code isn't valid");
    } finally {
      setPromoBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!items.length) return;
    setBusy(true);
    try {
      let address = addresses.find((row) => row.id === addressId);
      if (showNew || !address) {
        if (draft.line1.trim().length < 3) {
          toast.error("Add a street address for delivery");
          setBusy(false);
          return;
        }
        address = await db.entities.Address.create({ ...draft, is_default: addresses.length === 0 });
      }
      const placed = await placeOrder({
        data: {
          items: items.map((item) => ({ product_id: item.product_id, qty: item.qty })),
          address_label: address.label,
          address_line: address.line1,
          address_area: address.area ?? "",
          address_phone: address.phone ?? "",
          payment_method: payment,
          notes,
          promo_code: promo?.code || undefined,
        },
      });
      clearCart();
      toast.success(`Order ${placed.code} placed`);
      await router.invalidate();
      navigate({ to: "/order-details", search: { id: placed.id } });
    } catch (error) {
      toast.error(error?.message || "Could not place the order");
    } finally {
      setBusy(false);
    }
  };

  if (!items.length) {
    return (
      <CustomerShell>
        <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Checkout</h1>
        <div className="mt-4">
          <EmptyState
            title="Your basket is empty"
            description="Add a few items from a store menu and come back to check out."
            action={
              <Link
                to="/store-menu"
                className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#3B0A66]"
              >
                Browse a store
              </Link>
            }
          />
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Checkout</h1>
      <p className="text-[13px] text-[#8B7A9C]">
        {items.length} lines from {store?.name}
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Your basket</h2>
            <ul className="mt-3 divide-y divide-[#F3ECF9]">
              {items.map((item) => (
                <li key={item.product_id} className="flex items-center gap-3 py-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-[18px] ${item.tint || "bg-[#F6EEFB]"}`}>
                    {item.emoji || "🍽️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#1B1024]">{item.name}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">{formatNGN(item.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQty(item.product_id, item.qty - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F4EEFA] text-[#3B0A66]"
                      aria-label={`Reduce ${item.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-[12.5px] font-bold text-[#1B1024]">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.product_id, item.qty + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F4EEFA] text-[#3B0A66]"
                      aria-label={`Add another ${item.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-[74px] text-right text-[13px] font-bold text-[#2B0B4D]">
                    {formatNGN(item.price * item.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item.product_id)}
                    className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Deliver to</h2>
              <button
                type="button"
                onClick={() => setShowNew((value) => !value)}
                className="text-[12px] font-bold text-[#3B0A66] hover:text-[#FF7A00]"
              >
                {showNew ? "Use a saved address" : "New address"}
              </button>
            </div>

            {showNew ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { key: "label", placeholder: "Label (Home, Office)" },
                  { key: "line1", placeholder: "Street address" },
                  { key: "area", placeholder: "Area (Yaba)" },
                  { key: "phone", placeholder: "Phone" },
                ].map((field) => (
                  <input
                    key={field.key}
                    value={draft[field.key]}
                    onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                    placeholder={field.placeholder}
                    className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2.5 ring-1 transition ${
                      addressId === address.id ? "bg-[#F8F5FC] ring-[#4B2080]" : "bg-white ring-[#EFE7F6]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-0.5 accent-[#4B2080]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 text-[12.5px] font-bold text-[#1B1024]">
                        <MapPin className="h-3.5 w-3.5 text-[#FF7A00]" /> {address.label}
                      </span>
                      <span className="block truncate text-[11.5px] text-[#8B7A9C]">
                        {address.line1}
                        {address.area ? `, ${address.area}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
                {addresses.length === 0 && (
                  <p className="text-[12px] text-[#9A8CA8]">No saved addresses yet — add one above.</p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Payment method</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { key: "cash", label: "Cash on delivery", icon: Banknote, hint: "Pay the rider in cash" },
                { key: "card", label: "Card / POS on delivery", icon: CreditCard, hint: "Rider brings a POS" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPayment(option.key)}
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-left ring-1 transition ${
                    payment === option.key ? "bg-[#F8F5FC] ring-[#4B2080]" : "bg-white ring-[#EFE7F6]"
                  }`}
                >
                  <option.icon className="mt-0.5 h-4 w-4 text-[#4B2080]" />
                  <span>
                    <span className="block text-[12.5px] font-bold text-[#1B1024]">{option.label}</span>
                    <span className="block text-[11.5px] text-[#9A8CA8]">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Notes for the store or rider (optional)"
              className="mt-3 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
            />
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Promo code</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                placeholder="Enter a discount code"
                className="min-w-0 flex-1 rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] font-semibold uppercase outline-none focus:border-[#4B2080]"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={promoBusy}
                className="rounded-xl bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
              >
                {promoBusy ? "Checking…" : "Apply"}
              </button>
              {promo && (
                <button
                  type="button"
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                  className="text-[12px] font-bold text-[#8B7A9C] hover:text-[#A11D1D]"
                >
                  Remove
                </button>
              )}
            </div>
            {promo?.description && (
              <p className="mt-2 text-[11.5px] text-[#15693F]">
                {promo.code} · {promo.description}
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] lg:sticky lg:top-20">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Order summary</h2>
          <dl className="mt-3 space-y-2 text-[12.5px]">
            <div className="flex justify-between text-[#5B4A6B]">
              <dt>Subtotal</dt>
              <dd className="font-semibold text-[#1B1024]">{formatNGN(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#5B4A6B]">
              <dt>Delivery fee</dt>
              <dd className="font-semibold text-[#1B1024]">{formatNGN(deliveryFee)}</dd>
            </div>
            <div className="flex justify-between text-[#5B4A6B]">
              <dt>Service fee (5%)</dt>
              <dd className="font-semibold text-[#1B1024]">{formatNGN(serviceFee)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[#15693F]">
                <dt>Promo {promo?.code}</dt>
                <dd className="font-semibold">−{formatNGN(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[#F3ECF9] pt-2 text-[14px]">
              <dt className="font-bold text-[#1B1024]">Total</dt>
              <dd className="font-extrabold text-[#2B0B4D]">{formatNGN(total)}</dd>
            </div>
          </dl>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7A00] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
          >
            <ShoppingBag className="h-4 w-4" />
            {busy ? "Placing order…" : `Place order · ${formatNGN(total)}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#9A8CA8]">
            You will be able to track this order live once the store accepts it.
          </p>
        </aside>
      </form>
    </CustomerShell>
  );
}