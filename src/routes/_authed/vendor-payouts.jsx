import { createFileRoute } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import PayoutAccountCard from "@/components/avora/PayoutAccountCard";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { getMyPayoutAccount } from "@/lib/payout-fns";
import { vendorPayoutBoard } from "@/lib/platform-fns";
import { formatDateTime, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { HandCoins, Percent, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-payouts")({
  loader: async () => {
    const context = await getConsoleContext();
    const [board, account] = await Promise.all([
      vendorPayoutBoard(),
      getMyPayoutAccount({ data: { subject_type: "vendor" } }),
    ]);
    return { context, board, account };
  },
  head: () => ({ meta: [{ title: "Payouts · AVORA vendor" }] }),
  component: VendorPayouts,
});

function VendorPayouts() {
  const { context, board, account } = Route.useLoaderData();
  const store = board.store;

  if (!store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="payouts" badge="Vendor console" title="Payouts" role={context.role}>
        <EmptyState title="No store yet" description="Open a store to start receiving payouts and settlement reports." />
      </ConsoleShell>
    );
  }

  const rate = store.commission_rate ?? 0.1;
  const delivered = board.orders.filter((order) => order.status === "delivered");
  const gross = delivered.reduce((sum, order) => sum + (order.subtotal || 0), 0);
  const net = gross - Math.round(gross * rate);
  const paid = board.settlements.filter((row) => row.status === "paid").reduce((sum, row) => sum + (row.net || 0), 0);
  const pending = board.settlements.filter((row) => row.status !== "paid").reduce((sum, row) => sum + (row.net || 0), 0);

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="payouts"
      badge="Vendor console"
      title="Payouts"
      subtitle={`${store.name} · ${Math.round(rate * 100)}% AVORA commission · ${delivered.length} delivered orders`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivered sales" value={formatNGN(gross)} hint={`${delivered.length} orders`} icon={TrendingUp} tone="green" />
        <StatCard label="Commission" value={formatNGN(Math.round(gross * rate))} hint="AVORA fee" icon={Percent} tone="orange" />
        <StatCard label="Paid out" value={formatNGN(paid)} hint="Completed payouts" icon={Wallet} tone="purple" />
        <StatCard label="Awaiting payout" value={formatNGN(pending)} hint="Pending statements" icon={HandCoins} tone="blue" />
      </div>

      <p className="mt-3 text-[12px] text-[#8B7A9C]">
        Net earnings to date: <strong className="text-[#2B0B4D]">{formatNGN(net)}</strong> after commission.
      </p>

      <div className="mt-4">
        <PayoutAccountCard
          subjectType="vendor"
          account={account}
          defaultName={store.owner_name || context.user?.full_name || ""}
        />
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
          Payout statements
        </h2>
        {board.settlements.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No payouts yet"
              description="Statements appear here once AVORA settles your delivered orders."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {board.settlements.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1B1024]">
                    {row.period_start} → {row.period_end}
                  </p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {row.orders_count || 0} orders · ref {row.reference || "—"}
                  </p>
                </div>
                <span className="text-[11.5px] text-[#8B7A9C]">
                  gross {formatNGN(row.gross)} · fee {formatNGN(row.commission)}
                </span>
                <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(row.net)}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-bold",
                    row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                  )}
                >
                  {row.status === "paid" ? "Paid" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
          Settlement report · delivered orders
        </h2>
        {delivered.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No delivered orders" description="Delivered orders feed into your payout statements." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="bg-[#FBF8F3] text-[10.5px] uppercase tracking-[0.1em] text-[#A797B4]">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Delivered</th>
                  <th className="px-3 py-2.5 text-right">Sales</th>
                  <th className="px-3 py-2.5 text-right">Commission</th>
                  <th className="px-4 py-2.5 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECF9]">
                {delivered.slice(0, 12).map((order) => {
                  const sales = order.subtotal || 0;
                  const fee = Math.round(sales * rate);
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-[#1B1024]">{order.code}</p>
                        <p className="text-[11px] text-[#9A8CA8]">{order.customer_name || order.customer_email}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[#8B7A9C]">{formatDateTime(order.delivered_at || order.created_date)}</td>
                      <td className="px-3 py-2.5 text-right text-[#5B4A6B]">{formatNGN(sales)}</td>
                      <td className="px-3 py-2.5 text-right text-[#A95400]">{formatNGN(fee)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#2B0B4D]">{formatNGN(sales - fee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}