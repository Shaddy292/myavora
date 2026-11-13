import { createFileRoute, Link } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import StatusPill from "@/components/avora/StatusPill";
import RiderPayoutChart from "@/components/avora/admin/RiderPayoutChart";
import { adminOverview, getConsoleContext } from "@/lib/avora-fns";
import { riderMonthlyPayouts } from "@/lib/payout-fns";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { AlertTriangle, Bike, ShoppingBag, Users, Headphones, Store, Wallet } from "lucide-react";
import { ADMIN_NAV } from "@/lib/console-nav";

export const Route = createFileRoute("/_authed/admin")({
  loader: async () => {
    const context = await getConsoleContext();
    try {
      const [data, payouts] = await Promise.all([adminOverview(), riderMonthlyPayouts()]);
      return { context, data, payouts, denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, data: null, payouts: null, denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Admin · AVORA" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const { context, data, payouts, denied } = Route.useLoaderData();

  if (denied) {
    return (
      <ConsoleShell
        nav={ADMIN_NAV}
        active="overview"
        badge="Operations"
        title="Admin"
        role={context.role}
      >
        <Denied />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="overview"
      badge="Operations"
      title="Control room"
      subtitle={`Live across Nigeria · ${data.ridersOnline} riders online`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="GMV today" value={formatNGN(data.gmvToday)} icon={ShoppingBag} tone="green" hint={`${data.ordersToday} orders`} />
        <StatCard label="Active orders" value={data.activeOrders} icon={Bike} tone="purple" hint="In progress now" />
        <StatCard label="Riders online" value={data.ridersOnline} icon={Users} tone="blue" hint="Dispatching" />
        <StatCard label="Exceptions" value={data.exceptions.length} icon={AlertTriangle} tone="red" hint="Needs attention" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link to="/admin/verification" className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]">
          <Store className="h-4 w-4 text-[#4B2080]" />
          <p className="mt-1.5 text-[12px] text-[#8B7A9C]">Vendors pending</p>
          <p className="font-display text-[19px] font-extrabold text-[#1B1024]">{data.pendingStores}</p>
        </Link>
        <Link to="/admin/verification" className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]">
          <Bike className="h-4 w-4 text-[#FF7A00]" />
          <p className="mt-1.5 text-[12px] text-[#8B7A9C]">Riders pending</p>
          <p className="font-display text-[19px] font-extrabold text-[#1B1024]">{data.pendingRiders}</p>
        </Link>
        <Link to="/admin/finance" className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]">
          <Wallet className="h-4 w-4 text-[#1F7A4C]" />
          <p className="mt-1.5 text-[12px] text-[#8B7A9C]">Refunds to review</p>
          <p className="font-display text-[19px] font-extrabold text-[#1B1024]">{data.pendingRefunds}</p>
        </Link>
        <Link to="/support" className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]">
          <Headphones className="h-4 w-4 text-[#1E4A9E]" />
          <p className="mt-1.5 text-[12px] text-[#8B7A9C]">Open tickets</p>
          <p className="font-display text-[19px] font-extrabold text-[#1B1024]">{data.openTickets}</p>
        </Link>
      </div>

      <div className="mt-5">
        <RiderPayoutChart data={payouts} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Exceptions</h2>
          {data.exceptions.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-[#9A8CA8]">Nothing stalled — every order is moving.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#F3ECF9]">
              {data.exceptions.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">
                      {order.code} · {order.store_name}
                    </p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {order.cancel_reason || order.failure_reason || `${formatDateTime(order.created_date)} · stalled`}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Latest orders</h2>
            <Link to="/admin/orders" className="text-[11.5px] font-bold text-[#4B2080] hover:text-[#FF7A00]">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{order.store_name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">
                    {order.code} · {order.customer_name || order.customer_email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(order.total)}</span>
                  <StatusPill status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}