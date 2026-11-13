import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import PayoutAccountCard from "@/components/avora/PayoutAccountCard";
import { getConsoleContext } from "@/lib/avora-fns";
import { getMyPayoutAccount } from "@/lib/payout-fns";
import { RIDER_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Wallet, Banknote, TrendingUp, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/_authed/rider_/earnings")({
  loader: async () => {
    const context = await getConsoleContext();
    const [orders, settlements, account] = await Promise.all([
      db.entities.Order.filter({ rider_email: context.user.email }, { sort: "-created_date", limit: 100 }),
      db.entities.Settlement.filter({ subject_email: context.user.email }, { sort: "-created_date", limit: 30 }),
      getMyPayoutAccount({ data: { subject_type: "rider" } }),
    ]);
    return {
      context,
      orders: (orders.items ?? orders).filter((o) => o.status === "delivered"),
      settlements: settlements.items ?? settlements,
      account,
    };
  },
  head: () => ({ meta: [{ title: "Earnings · AVORA" }] }),
  component: RiderEarnings,
});

function RiderEarnings() {
  const { context, orders, settlements, account } = Route.useLoaderData();
  const rider = context.rider;
  const today = new Date().toISOString().slice(0, 10);

  const earnedToday = orders
    .filter((o) => (o.delivered_at || "").slice(0, 10) === today)
    .reduce((s, o) => s + (o.rider_payout || 0), 0);
  const lifetime = orders.reduce((s, o) => s + (o.rider_payout || 0), 0);
  const cashCollected = orders.filter((o) => o.cash_collected).reduce((s, o) => s + (o.total || 0), 0);
  const paidOut = settlements.filter((s) => s.status === "paid").reduce((s, x) => s + x.net, 0);

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="earnings"
      badge="Rider console"
      title="Earnings & cash"
      subtitle={rider ? `${rider.full_name} · ${rider.deliveries_count || 0} lifetime deliveries` : "No rider profile"}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={formatNGN(earnedToday)} icon={TrendingUp} tone="green" hint="Delivery payouts" />
        <StatCard label="Lifetime payouts" value={formatNGN(lifetime)} icon={Wallet} tone="purple" hint={`${orders.length} deliveries`} />
        <StatCard label="Cash collected" value={formatNGN(cashCollected)} icon={Banknote} tone="orange" hint="Order value handled" />
        <StatCard label="Settled to you" value={formatNGN(paidOut)} icon={ReceiptText} tone="blue" hint="Paid statements" />
      </div>

      <div className="mt-4">
        <PayoutAccountCard
          subjectType="rider"
          account={account}
          defaultName={rider?.full_name || context.user?.full_name || ""}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Deliveries
          </h2>
          {orders.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No completed deliveries" description="Completed trips and their payouts appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#F3ECF9]">
              {orders.slice(0, 10).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{order.store_name}</p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {order.code} · {formatDateTime(order.delivered_at || order.created_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(order.rider_payout || 0)}</p>
                    <p className="text-[10.5px] text-[#9A8CA8]">
                      {order.payment_method === "cash" ? "cash order" : "paid online"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Payout statements
          </h2>
          {settlements.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No statements yet"
                description="Operations generates rider payouts weekly from delivered trips."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#F3ECF9]">
              {settlements.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#1B1024]">
                      {row.period_start} → {row.period_end}
                    </p>
                    <p className="text-[11px] text-[#9A8CA8]">{row.orders_count} deliveries</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(row.net)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                        row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                      }`}
                    >
                      {row.status === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {rider?.cash_on_hand > 0 && (
        <p className="mt-4 rounded-xl bg-[#FFF6EA] px-4 py-3 text-[12.5px] text-[#8A5200] ring-1 ring-[#FBE3C4]">
          You're holding <strong>{formatNGN(rider.cash_on_hand)}</strong> in cash from cash-on-delivery orders. Remit it
          at your next settlement.
        </p>
      )}
    </ConsoleShell>
  );
}