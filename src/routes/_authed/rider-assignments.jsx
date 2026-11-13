import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import RiderApply from "@/components/avora/console/RiderApply";
import EmptyState from "@/components/avora/EmptyState";
import StatusPill from "@/components/avora/StatusPill";
import { RIDER_NAV } from "@/lib/console-nav";
import { advanceOrder, getConsoleContext } from "@/lib/avora-fns";
import { riderAssignments } from "@/lib/order-fns";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Bike, MapPin, PackageCheck, Store } from "lucide-react";

export const Route = createFileRoute("/_authed/rider-assignments")({
  loader: async () => {
    const context = await getConsoleContext();
    const data = await riderAssignments();
    return { context, data };
  },
  head: () => ({ meta: [{ title: "Assignments · AVORA rider" }] }),
  component: RiderAssignments,
});

function RiderAssignments() {
  const { context, data } = Route.useLoaderData();
  const router = useRouter();
  const advance = useServerFn(advanceOrder);
  const [busy, setBusy] = useState(null);

  if (!data.rider) {
    return (
      <ConsoleShell nav={RIDER_NAV} active="assignments" badge="Rider console" title="Assignments" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <RiderApply />
        </div>
      </ConsoleShell>
    );
  }

  const run = async (order, action, note) => {
    setBusy(order.id);
    try {
      await advance({ data: { order_id: order.id, action, note } });
      toast.success(action === "pickup" ? "Marked as picked up" : "Delivery completed");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this delivery");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="assignments"
      badge="Rider console"
      title="My assignments"
      subtitle={`${data.active.length} active · ${data.history.length} completed`}
      role={context.role}
    >
      {data.active.length === 0 ? (
        <EmptyState
          title="No active assignments"
          description="Claim a job from the deliveries board and it will show up here with the pickup and drop-off."
          action={
            <Link to="/rider" className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white">
              Open deliveries
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.active.map((order) => (
            <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display truncate text-[15px] font-bold text-[#1B1024]">{order.code}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">{formatDateTime(order.created_date)}</p>
                </div>
                <StatusPill status={order.status} />
              </div>

              <div className="mt-3 space-y-2 text-[12.5px]">
                <p className="flex items-start gap-1.5 text-[#5B4A6B]">
                  <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1F7A4C]" />
                  <span>
                    <strong className="text-[#1B1024]">Pickup</strong> · {order.store_name}
                    {order.address_area ? ` (${order.address_area})` : ""}
                  </span>
                </p>
                <p className="flex items-start gap-1.5 text-[#5B4A6B]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A00]" />
                  <span>
                    <strong className="text-[#1B1024]">Drop-off</strong> · {order.address_line}
                    {order.address_area ? `, ${order.address_area}` : ""}
                  </span>
                </p>
                <p className="flex items-center gap-1.5 text-[#5B4A6B]">
                  <Bike className="h-3.5 w-3.5 text-[#4B2080]" />
                  {(order.items ?? []).length} items · {formatNGN(order.total)} · your payout{" "}
                  <strong className="text-[#2B0B4D]">{formatNGN(order.rider_payout)}</strong>
                </p>
                {order.address_phone && (
                  <p className="text-[11.5px] text-[#8B7A9C]">Customer phone · {order.address_phone}</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {order.status === "rider_assigned" && (
                  <button
                    type="button"
                    disabled={busy === order.id}
                    onClick={() => run(order, "pickup", "Picked up from store")}
                    className="flex items-center gap-1 rounded-full bg-[#2B0B4D] px-3.5 py-2 text-[11.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Picked up
                  </button>
                )}
                {order.status === "picked_up" && (
                  <button
                    type="button"
                    disabled={busy === order.id}
                    onClick={() => run(order, "deliver", "Delivered to customer")}
                    className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-3.5 py-2 text-[11.5px] font-bold text-white transition hover:bg-[#1A6A42] disabled:opacity-60"
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Delivered
                  </button>
                )}
                <Link
                  to="/rider-tracking"
                  search={{ id: order.id }}
                  className="rounded-full bg-[#F4EEFA] px-3.5 py-2 text-[11.5px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5]"
                >
                  View route
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="border-b border-[#F3ECF9] px-4 py-3 font-display text-[15px] font-bold text-[#1B1024]">
          Completed assignments
        </h2>
        {data.history.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-[#9A8CA8]">Nothing completed yet.</p>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {data.history.slice(0, 10).map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#1B1024]">
                    {order.code} · {order.address_area || order.address_line}
                  </p>
                  <p className="text-[11px] text-[#9A8CA8]">{formatDateTime(order.created_date)}</p>
                </div>
                <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(order.rider_payout)}</span>
                <StatusPill status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}