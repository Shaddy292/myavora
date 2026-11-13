import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { getConsoleContext } from "@/lib/avora-fns";
import { RIDER_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Banknote, PackageCheck, Percent, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authed/rider-settlements")({
  loader: async () => {
    const context = await getConsoleContext();
    const [ordersPage, settlementsPage] = await Promise.all([
      db.entities.Order.filter({ rider_email: context.user.email }, { sort: "-created_date", limit: 100 }),
      db.entities.Settlement.filter(
        { subject_email: context.user.email },
        { sort: "-created_date", limit: 50 }
      ),
    ]);
    const orders = (ordersPage.items ?? ordersPage).filter((order) => order.status === "delivered");
    return { context, orders, settlements: settlementsPage.items ?? settlementsPage };
  },
  head: () => ({ meta: [{ title: "Rider settlements · AVORA" }] }),
  component: RiderSettlements,
});

function RiderSettlements() {
  const { context, orders, settlements } = Route.useLoaderData();
  const net = orders.reduce((total, order) => total + (order.rider_payout || 0), 0);
  const commission = settlements.reduce((total, row) => total + (row.commission || 0), 0);
  const gross = settlements.reduce((total, row) => total + (row.gross || 0), 0);
  const paid = settlements.filter((row) => row.status === "paid").reduce((total, row) => total + (row.net || 0), 0);

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="riderSettlements"
      badge="Rider console"
      title="Settlements"
      subtitle={`${orders.length} completed deliveries · ${formatNGN(paid)} already paid out`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivery fees earned" value={formatNGN(net)} icon={Wallet} tone="green" hint="Net of commission" />
        <StatCard label="Gross settled" value={formatNGN(gross)} icon={Banknote} tone="purple" hint="Before commission" />
        <StatCard label="Commission deducted" value={formatNGN(commission)} icon={Percent} tone="orange" hint="AVORA's 10%" />
        <StatCard label="Paid to bank" value={formatNGN(paid)} icon={PackageCheck} tone="blue" hint="Released statements" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Statement breakdown
          </h2>
          {settlements.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No settlements yet"
                description="Completed trips are grouped into statements with the commission shown per period."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.1em] text-[#9A8CA8]">
                    <th className="px-4 py-2 font-semibold">Period</th>
                    <th className="px-4 py-2 text-right font-semibold">Trips</th>
                    <th className="px-4 py-2 text-right font-semibold">Gross</th>
                    <th className="px-4 py-2 text-right font-semibold">Commission</th>
                    <th className="px-4 py-2 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3ECF9]">
                  {settlements.map((row) => (
                    <tr key={row.id} className="text-[12.5px] text-[#1B1024]">
                      <td className="px-4 py-2.5">
                        <p className="font-semibold">{row.period_start || "—"}</p>
                        <span
                          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                            row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                          }`}
                        >
                          {row.status === "paid" ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[#8B7A9C]">{row.orders_count ?? 0}</td>
                      <td className="px-4 py-2.5 text-right">{formatNGN(row.gross || 0)}</td>
                      <td className="px-4 py-2.5 text-right text-[#A95400]">−{formatNGN(row.commission || 0)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2B0B4D]">{formatNGN(row.net || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Completed deliveries
          </h2>
          {orders.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No completed deliveries" description="Delivered trips and their payout appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#F3ECF9]">
              {orders.slice(0, 12).map((order) => (
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
      </div>
    </ConsoleShell>
  );
}