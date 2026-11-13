import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import CustomerShell from "@/components/avora/CustomerShell";
import BackButton from "@/components/avora/BackButton";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import OrderTimeline from "@/components/avora/order/OrderTimeline";
import OrderReviewForm from "@/components/avora/order/OrderReviewForm";
import { ACTIVE_STATUSES, formatNGN, formatDateTime } from "@/lib/avora";
import { getMyOrder } from "@/lib/order-fns";
import { advanceOrder } from "@/lib/avora-fns";
import { cartLinesFromOrder, replaceCart } from "@/lib/cart";
import { Bike, MapPin, Phone, RotateCcw, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authed/order-details")({
  validateSearch: (search) => ({ id: search.id || undefined }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    if (!deps.id) return { order: null };
    return { order: await getMyOrder({ data: { id: deps.id } }) };
  },
  head: () => ({ meta: [{ title: "Order details · AVORA" }] }),
  component: OrderDetails,
});

function OrderDetails() {
  const { order } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!order) {
    return (
      <CustomerShell>
        <EmptyState
          title="Order not found"
          description="We could not find that order on your account."
          action={<BackButton label="Back to orders" fallbackTo="/order-history" />}
        />
      </CustomerShell>
    );
  }

  const active = ACTIVE_STATUSES.includes(order.status);

  const reorder = () => {
    replaceCart(cartLinesFromOrder(order));
    toast.success("Items added to your basket");
    navigate({ to: "/checkout" });
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await advanceOrder({ data: { order_id: order.id, action: "cancel", note: "Cancelled by customer" } });
      toast.success("Order cancelled");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not cancel this order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.03em] text-[#1B1024]">
            {order.store_name}
          </h1>
          <p className="text-[12.5px] text-[#8B7A9C]">
            {order.code} · {formatDateTime(order.created_date)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Items</h2>
            <ul className="mt-3 divide-y divide-[#F3ECF9]">
              {(order.items ?? []).map((item, index) => (
                <li key={`${item.product_id}-${index}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[#1B1024]">{item.name}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">
                      {item.qty} × {formatNGN(item.unit_price)}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-[#2B0B4D]">
                    {formatNGN((item.unit_price || 0) * (item.qty || 0))}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-[#F3ECF9] pt-3 text-[12.5px]">
              <div className="flex justify-between text-[#5B4A6B]">
                <dt>Subtotal</dt>
                <dd className="font-semibold text-[#1B1024]">{formatNGN(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-[#5B4A6B]">
                <dt>Delivery fee</dt>
                <dd className="font-semibold text-[#1B1024]">{formatNGN(order.delivery_fee)}</dd>
              </div>
              <div className="flex justify-between text-[#5B4A6B]">
                <dt>Service fee</dt>
                <dd className="font-semibold text-[#1B1024]">{formatNGN(order.service_fee)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-[14px]">
                <dt className="font-bold text-[#1B1024]">Total</dt>
                <dd className="font-extrabold text-[#2B0B4D]">{formatNGN(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11.5px] text-[#9A8CA8]">
              {order.payment_method === "cash" ? "Cash on delivery" : "Card / POS on delivery"} ·{" "}
              {String(order.payment_status || "").replace(/_/g, " ")}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Delivery details</h2>
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-[#5B4A6B]">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A00]" />
              <span>
                <strong className="text-[#1B1024]">{order.address_label || "Delivery"}</strong> — {order.address_line}
                {order.address_area ? `, ${order.address_area}` : ""}
              </span>
            </p>
            {order.address_phone && (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#5B4A6B]">
                <Phone className="h-3.5 w-3.5 text-[#FF7A00]" /> {order.address_phone}
              </p>
            )}
            {order.rider_name && (
              <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#F8F5FC] px-3 py-2 text-[12.5px] font-semibold text-[#2B0B4D]">
                <Bike className="h-4 w-4 text-[#FF7A00]" /> Rider: {order.rider_name}
                {order.rider_phone ? ` · ${order.rider_phone}` : ""}
              </p>
            )}
            {order.notes && <p className="mt-2 text-[12px] italic text-[#8B7A9C]">“{order.notes}”</p>}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Status</h2>
            <div className="mt-3">
              <OrderTimeline order={order} />
            </div>
          </section>

          {order.status === "delivered" && (
            <OrderReviewForm order={order} onDone={() => router.invalidate()} />
          )}

          <div className="grid gap-2">
            <button
              type="button"
              onClick={reorder}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reorder these items
            </button>
            {active && (
              <Link
                to="/live-tracking"
                search={{ id: order.id }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#FFF1E4] px-4 py-2.5 text-[12.5px] font-bold text-[#B05C00] transition hover:bg-[#FFE6CC]"
              >
                <Bike className="h-3.5 w-3.5" /> Track this delivery
              </Link>
            )}
            {["placed", "accepted"].includes(order.status) && (
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] transition hover:bg-[#FDECEC] disabled:opacity-60"
              >
                <XCircle className="h-3.5 w-3.5" /> {busy ? "Cancelling…" : "Cancel order"}
              </button>
            )}
            <Link
              to="/support"
              className="flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6] transition hover:text-[#2B0B4D]"
            >
              Get help with this order
            </Link>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}