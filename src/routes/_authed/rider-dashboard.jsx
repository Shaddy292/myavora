import { createFileRoute, Link } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import StatusPill from "@/components/avora/StatusPill";
import { availableJobs, getConsoleContext } from "@/lib/avora-fns";
import { RIDER_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Bike, HandCoins, MapPin, PackageCheck, Wallet } from "lucide-react";

const ACTIVE = ["accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up"];

export const Route = createFileRoute("/_authed/rider-dashboard")({
  loader: async () => {
    const context = await getConsoleContext();
    const [page, jobs] = await Promise.all([
      db.entities.Order.filter({ rider_email: context.user.email }, { sort: "-created_date", limit: 100 }),
      availableJobs(),
    ]);
    return { context, orders: page.items ?? page, jobs };
  },
  head: () => ({ meta: [{ title: "Rider dashboard · AVORA" }] }),
  component: RiderDashboard,
});

function RiderDashboard() {
  const { context, orders, jobs } = Route.useLoaderData();
  const rider = context.rider;
  const today = new Date().toISOString().slice(0, 10);

  const delivered = orders.filter((order) => order.status === "delivered");
  const active = orders.filter((order) => ACTIVE.includes(order.status));
  const earnedToday = delivered
    .filter((order) => (order.delivered_at || "").slice(0, 10) === today)
    .reduce((total, order) => total + (order.rider_payout || 0), 0);
  const lifetime = delivered.reduce((total, order) => total + (order.rider_payout || 0), 0);

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="riderHome"
      badge="Rider console"
      title="Rider dashboard"
      subtitle={
        rider
          ? `${rider.full_name} · ${rider.is_online ? "online" : "offline"} · ${rider.status}`
          : "No rider profile yet"
      }
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Earned today" value={formatNGN(earnedToday)} icon={Wallet} tone="green" hint="Delivered trips" />
        <StatCard label="Active deliveries" value={String(active.length)} icon={Bike} tone="orange" hint="In progress now" />
        <StatCard label="Completed trips" value={String(delivered.length)} icon={PackageCheck} tone="purple" hint="All time" />
        <StatCard label="Open requests" value={String(jobs.length)} icon={HandCoins} tone="blue" hint="Waiting for a rider" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <div className="flex items-center justify-between border-b border-[#F3ECF9] px-4 py-3">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Active deliveries</h2>
            <Link to="/rider" className="text-[11.5px] font-bold text-[#2B0B4D]">
              Open board
            </Link>
          </div>
          {active.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing in flight" description="Claim a delivery request to start earning." />
            </div>
          ) : (
            <ul className="divide-y divide-[#F3ECF9]">
              {active.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{order.store_name}</p>
                    <p className="flex items-center gap-1 text-[11px] text-[#9A8CA8]">
                      <MapPin className="h-3 w-3" /> {order.address_area || order.address_line || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(order.rider_payout || 0)}</span>
                    <StatusPill status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <div className="flex items-center justify-between border-b border-[#F3ECF9] px-4 py-3">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Delivery requests nearby</h2>
            <Link to="/rider-assignments" className="text-[11.5px] font-bold text-[#2B0B4D]">
              Claim
            </Link>
          </div>
          {jobs.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No open requests" description="New pickups appear here as stores mark orders ready." />
            </div>
          ) : (
            <ul className="divide-y divide-[#F3ECF9]">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{job.store_name}</p>
                    <p className="truncate text-[11px] text-[#9A8CA8]">
                      {job.address_area || job.address_line || "—"} · {job.code}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-bold text-[#1F7A4C]">{formatNGN(job.delivery_fee || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
          Recent completed trips
        </h2>
        {delivered.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No completed trips yet" description={`Lifetime earnings: ${formatNGN(lifetime)}`} />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {delivered.slice(0, 8).map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{order.store_name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">
                    {order.code} · {formatDateTime(order.delivered_at || order.created_date)}
                  </p>
                </div>
                <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(order.rider_payout || 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}