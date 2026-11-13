import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import OrderTimeline from "@/components/avora/order/OrderTimeline";
import StatusPill from "@/components/avora/StatusPill";
import { ACTIVE_STATUSES, formatDateTime, formatNGN } from "@/lib/avora";
import { coordsFor, nudge, RIDER_PROGRESS } from "@/lib/geo";
import { getMyOrder, listMyOrders } from "@/lib/order-fns";
import { Bike, Clock, MapPin, Phone } from "lucide-react";

const RiderRouteMap = lazy(() => import("@/components/avora/RiderRouteMap"));

export const Route = createFileRoute("/_authed/live-tracking")({
  validateSearch: (search) => ({ id: search.id || undefined }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    const orders = await listMyOrders();
    const active = orders.filter((row) => ACTIVE_STATUSES.includes(row.status));
    const selected = deps.id ? orders.find((row) => row.id === deps.id) ?? (await getMyOrder({ data: { id: deps.id } })) : null;
    return { order: selected ?? active[0] ?? orders[0] ?? null, live: active.length };
  },
  head: () => ({ meta: [{ title: "Live tracking · AVORA" }] }),
  component: LiveTracking,
});

function LiveTracking() {
  const { order, live } = Route.useLoaderData();

  if (!order) {
    return (
      <CustomerShell>
        <EmptyState
          title="Nothing to track yet"
          description="Place an order and this page follows your rider from the store to your door."
          action={
            <Link to="/store-directory" className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white">
              Find a store
            </Link>
          }
        />
      </CustomerShell>
    );
  }

  const storePoint = nudge(coordsFor(order.store_name), order.store_id || order.code);
  const customerPoint = nudge(coordsFor(order.address_area), order.address_area || order.code);
  const ratio = RIDER_PROGRESS[order.status] ?? 0;
  const onTheWay = ["rider_assigned", "picked_up"].includes(order.status);

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">
            {live > 1 ? `${live} active orders` : "Live tracking"}
          </p>
          <h1 className="font-display mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[#1B1024]">
            {order.store_name}
          </h1>
          <p className="text-[12.5px] text-[#8B7A9C]">
            {order.code} · {formatNGN(order.total)} · {formatDateTime(order.created_date)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Suspense fallback={<div className="h-[300px] animate-pulse rounded-2xl bg-[#F2EEF7] md:h-[370px]" />}>
            <RiderRouteMap
              storePoint={storePoint}
              customerPoint={customerPoint}
              riderRatio={ratio}
              storeName={order.store_name}
              customerLabel={order.address_label || "Your door"}
            />
          </Suspense>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-2xl bg-white p-3 text-[12px] font-semibold text-[#5B4A6B] ring-1 ring-[#EFE7F6]">
              <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A797B4]">
                <MapPin className="h-3 w-3" /> Drop-off
              </span>
              {order.address_line}
              {order.address_area ? `, ${order.address_area}` : ""}
            </p>
            <p className="rounded-2xl bg-white p-3 text-[12px] font-semibold text-[#5B4A6B] ring-1 ring-[#EFE7F6]">
              <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A797B4]">
                <Clock className="h-3 w-3" /> Status
              </span>
              {onTheWay ? "Rider is on the move" : order.status === "delivered" ? "Delivered" : "Waiting on the store"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Your rider</h2>
            {order.rider_name ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#F8F5FC] px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF7A00] text-white">
                  <Bike className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#1B1024]">{order.rider_name}</p>
                  <p className="text-[11.5px] text-[#8B7A9C]">Carrying your order</p>
                </div>
                {order.rider_phone && (
                  <a
                    href={`tel:${order.rider_phone}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#2B0B4D] ring-1 ring-[#EFE7F6]"
                    aria-label="Call your rider"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-[#8B7A9C]">
                We are matching the closest rider to {order.store_name}. Their name and number appear here.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Progress</h2>
            <div className="mt-3">
              <OrderTimeline order={order} />
            </div>
            <p className="mt-3 text-[11px] text-[#9A8CA8]">Last update {formatDateTime(order.updated_date)} · Africa/Lagos</p>
          </section>

          <Link
            to="/order-details"
            search={{ id: order.id }}
            className="block rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-center text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]"
          >
            Order details & receipt
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}