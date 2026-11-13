import { createFileRoute, Link } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import StatCard from "@/components/avora/StatCard";
import StatusPill from "@/components/avora/StatusPill";
import DispatchRiderCard from "@/components/avora/admin/DispatchRiderCard";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN, timeAgo } from "@/lib/avora";
import { Bike, CalendarClock, PackageCheck, Users } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-dispatch")({
  loader: async () => {
    const context = await getConsoleContext();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
    if (context.role !== "admin") return { context, riders: [], shifts: [], orders: [], today };
    const [riders, shiftPage, orderPage] = await Promise.all([
      db.entities.RiderProfile.list("-created_date", 200),
      db.entities.RiderShift.filter({ date: today }, { limit: 200 }),
      db.entities.Order.filter(
        { status: { $in: ["ready_for_pickup", "rider_assigned", "picked_up"] } },
        { sort: "created_date", limit: 60 }
      ),
    ]);
    return {
      context,
      today,
      riders,
      shifts: shiftPage.items ?? shiftPage,
      orders: orderPage.items ?? orderPage,
    };
  },
  head: () => ({ meta: [{ title: "Rider dispatch · AVORA admin" }] }),
  component: AdminDispatch,
});

function AdminDispatch() {
  const { context, riders, shifts, orders, today } = Route.useLoaderData();

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="dispatch" badge="Operations" title="Rider dispatch" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const online = riders.filter((rider) => rider.is_online);
  const waiting = orders.filter((order) => order.status === "ready_for_pickup" && !order.rider_email);
  const inTransit = orders.filter((order) => order.status === "rider_assigned" || order.status === "picked_up");
  const shiftByEmail = new Map(shifts.map((shift) => [shift.user_email, shift]));
  const loadByEmail = inTransit.reduce((map, order) => {
    map[order.rider_email] = (map[order.rider_email] ?? 0) + 1;
    return map;
  }, {});

  const roster = [...riders].sort((a, b) => Number(b.is_online) - Number(a.is_online) || a.full_name.localeCompare(b.full_name));

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="dispatch"
      badge="Operations"
      title="Rider dispatch"
      subtitle={`${online.length} riders online · ${shifts.length} shifts today`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Riders online" value={online.length} hint={`${riders.length} in the fleet`} icon={Users} tone="green" />
        <StatCard label="On shift today" value={shifts.length} hint={today} icon={CalendarClock} tone="blue" />
        <StatCard label="Awaiting rider" value={waiting.length} hint="Ready for pickup" icon={PackageCheck} tone="orange" />
        <StatCard label="In transit" value={inTransit.length} hint="Picked up or assigned" icon={Bike} tone="purple" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Rider availability</h2>
              <p className="text-[11.5px] text-[#9A8CA8]">Online riders first, with today's shift.</p>
            </div>
            <Link to="/rider-assignments" className="text-[11.5px] font-bold text-[#3B0A66] hover:text-[#FF7A00]">
              Rider view
            </Link>
          </div>
          {roster.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No riders yet" description="Approved riders appear here as soon as they sign up." />
            </div>
          ) : (
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {roster.map((rider) => (
                <DispatchRiderCard
                  key={rider.id}
                  rider={rider}
                  shift={shiftByEmail.get(rider.user_email)}
                  activeCount={loadByEmail[rider.user_email] ?? 0}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Awaiting a rider</h2>
            <p className="text-[11.5px] text-[#9A8CA8]">Packed orders that nobody has claimed yet.</p>
            {waiting.length === 0 ? (
              <p className="mt-3 rounded-xl bg-[#FBF8F3] px-3 py-3 text-[12px] text-[#8B7A9C]">
                Every packed order has a rider. Nice.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {waiting.map((order) => (
                  <li key={order.id} className="flex items-center gap-2.5 rounded-xl bg-[#FBF8F3] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-[#1B1024]">{order.code}</p>
                      <p className="truncate text-[11px] text-[#9A8CA8]">
                        {order.store_name} → {order.address_area || "customer"} · {timeAgo(order.created_date)}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(order.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/orders"
              className="mt-3 block rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-center text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]"
            >
              Open the order desk
            </Link>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Active assignments</h2>
            {inTransit.length === 0 ? (
              <p className="mt-2 text-[12px] text-[#8B7A9C]">No deliveries are moving right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {inTransit.map((order) => (
                  <li key={order.id} className="flex items-center gap-2.5 rounded-xl bg-[#FBF8F3] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-[#1B1024]">
                        {order.code} · {order.rider_name || "Unnamed rider"}
                      </p>
                      <p className="truncate text-[11px] text-[#9A8CA8]">
                        {order.store_name} · {order.rider_phone || "no phone"}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </ConsoleShell>
  );
}