import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect } from "react";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import OrderTimeline from "@/components/avora/order/OrderTimeline";
import StatusPill from "@/components/avora/StatusPill";
import { ACTIVE_STATUSES, formatDateTime, formatNGN } from "@/lib/avora";
import { RIDER_PROGRESS, coordsFor, nudge } from "@/lib/geo";
import { getMyOrder, listMyOrders } from "@/lib/order-fns";
import { Bike, Clock, MapPin, Navigation, Phone } from "lucide-react";

const RiderRouteMap = lazy(() => import("@/components/avora/RiderRouteMap"));

export const Route = createFileRoute("/_authed/order-tracking")({
  validateSearch: (search) => ({ id: search.id || undefined }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    const orders = await listMyOrders();
    const active = orders.filter((row) => ACTIVE_STATUSES.includes(row.status));
    const selected = deps.id
      ? orders.find((row) => row.id === deps.id) ?? (await getMyOrder({ data: { id: deps.id } }))
      : null;
    return { order: selected ?? active[0] ?? null, active };
  },
  head: () => ({ meta: [{ title: "Order tracking · AVORA" }] }),
  component: OrderTracking,
});

const STAGES = [
  { key: "placed", label: "Placed" },
  { key: "preparing", label: "Preparing" },
  { key: "rider_assigned", label: "Rider" },
  { key: "picked_up", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

function stageIndex(status) {
  if (status === "delivered") return 4;
  if (status === "picked_up") return 3;
  if (status === "rider_assigned" || status === "ready_for_pickup") return 2;
  if (status === "preparing" || status === "accepted") return 1;
  return 0;
}

function OrderTracking() {
  const { order, active } = Route.useLoaderData();
  const router = useRouter();

  useEffect(() => {
    if (!order || !ACTIVE_STATUSES.includes(order.status)) return undefined;
    const timer = setInterval(() => router.invalidate(), 30000);
    return () => clearInterval(timer);
  }, [order, router]);

  if (!order) {
    return (
      <CustomerShell>
        <EmptyState
          title="No active delivery"
          description="Once you place an order, this page follows it live from the store to your door."
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
  const stage = stageIndex(order.status);
  const etaLeft = Math.max(4, Math.round(28 * (1 - ratio)));
  const live = ACTIVE_STATUSES.includes(order.status);
  const store = order.store_name;

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">
            {live ? "Live delivery" : "Completed delivery"}
          </p>
          <h1 className="font-display mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-[#1B1024]">
            {order.code}
          </h1>
          <p className="text-[12.5px] text-[#8B7A9C]">
            {store} · {formatNGN(order.total)} · placed {formatDateTime(order.created_date)}
          </p>
        </div>
        <StatusPill status={order.status} />
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Progress</h2>
          <span className="flex items-center gap-1 text-[12px] font-bold text-[#B05C00]">
            <Clock className="h-3.5 w-3.5" /> {live ? `~${etaLeft} min away` : "Delivered"}
          </span>
        </div>
        <ol className="mt-3 grid grid-cols-5 gap-1">
          {STAGES.map((entry, index) => (
            <li key={entry.key} className="text-center">
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  index <= stage ? "bg-[#2B0B4D] text-white" : "bg-[#F2EEF7] text-[#A797B4]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`mt-1 block text-[10px] font-semibold ${index <= stage ? "text-[#2B0B4D]" : "text-[#A797B4]"}`}>
                {entry.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F2EEF7]">
          <div className="h-full rounded-full bg-[#FF7A00] transition-all" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Suspense fallback={<div className="h-[300px] animate-pulse rounded-2xl bg-[#F2EEF7] md:h-[370px]" />}>
            <RiderRouteMap
              storePoint={storePoint}
              customerPoint={customerPoint}
              riderRatio={ratio}
              storeName={store}
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
                <Navigation className="h-3 w-3" /> Pickup
              </span>
              {store}
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
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {order.status === "picked_up" ? "Carrying your order" : "Heading to the store"}
                  </p>
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
                We are matching the closest rider to {store}. Their details appear here.
              </p>
            )}
          </section>

          {active.length > 1 && (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Other active orders</h2>
              <ul className="mt-2 space-y-1.5">
                {active
                  .filter((row) => row.id !== order.id)
                  .map((row) => (
                    <li key={row.id}>
                      <Link
                        to="/order-tracking"
                        search={{ id: row.id }}
                        className="flex items-center justify-between rounded-xl bg-[#FBF8F3] px-3 py-2 text-[12px] font-semibold text-[#5B4A6B]"
                      >
                        <span>{row.code} · {row.store_name}</span>
                        <StatusPill status={row.status} />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Timeline</h2>
            <div className="mt-3">
              <OrderTimeline order={order} />
            </div>
          </section>
        </div>
      </div>
    </CustomerShell>
  );
}