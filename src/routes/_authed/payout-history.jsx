import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { getConsoleContext } from "@/lib/avora-fns";
import { RIDER_NAV, VENDOR_NAV } from "@/lib/console-nav";
import { formatNGN } from "@/lib/avora";
import { Banknote, Percent, Wallet, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/_authed/payout-history")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!["vendor", "rider"].includes(context.role)) return { context, settlements: [] };
    const page = await db.entities.Settlement.filter(
      { subject_email: context.user.email },
      { sort: "-created_date", limit: 100 }
    );
    return { context, settlements: page.items ?? page };
  },
  head: () => ({ meta: [{ title: "Payout history · AVORA" }] }),
  component: PayoutHistory,
});

function PayoutHistory() {
  const { context, settlements } = Route.useLoaderData();
  const isVendor = context.role === "vendor";
  const nav = isVendor ? VENDOR_NAV : RIDER_NAV;
  const active = isVendor ? "payoutHistory" : "riderPayoutHistory";

  if (!["vendor", "rider"].includes(context.role)) {
    return (
      <ConsoleShell nav={nav} active={active} badge="Payouts" title="Payout history" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const paid = settlements.filter((row) => row.status === "paid");
  const pending = settlements.filter((row) => row.status !== "paid");
  const sum = (list, key) => list.reduce((total, row) => total + (row[key] || 0), 0);

  return (
    <ConsoleShell
      nav={nav}
      active={active}
      badge={isVendor ? "Vendor console" : "Rider console"}
      title="Payout history"
      subtitle={`${settlements.length} statements · ${formatNGN(sum(paid, "net"))} paid to you`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross earned" value={formatNGN(sum(settlements, "gross"))} icon={Wallet} tone="purple" hint="Before deductions" />
        <StatCard label="Commission" value={formatNGN(sum(settlements, "commission"))} icon={Percent} tone="orange" hint="AVORA's cut" />
        <StatCard label="Net paid" value={formatNGN(sum(paid, "net"))} icon={Banknote} tone="green" hint={`${paid.length} statements`} />
        <StatCard label="Awaiting release" value={formatNGN(sum(pending, "net"))} icon={ReceiptText} tone="blue" hint={`${pending.length} pending`} />
      </div>

      <div className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
          Statements
        </h2>
        {settlements.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No payouts yet"
              description="Each settlement period closes with a statement showing your gross sales and the commission deducted."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.1em] text-[#9A8CA8]">
                  <th className="px-4 py-2 font-semibold">Period</th>
                  <th className="px-4 py-2 font-semibold">Orders</th>
                  <th className="px-4 py-2 text-right font-semibold">Gross</th>
                  <th className="px-4 py-2 text-right font-semibold">Commission</th>
                  <th className="px-4 py-2 text-right font-semibold">Deductions</th>
                  <th className="px-4 py-2 text-right font-semibold">Net</th>
                  <th className="px-4 py-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECF9]">
                {settlements.map((row) => (
                  <tr key={row.id} className="text-[12.5px] text-[#1B1024]">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold">{row.period_start || "—"}</p>
                      <p className="text-[11px] text-[#9A8CA8]">to {row.period_end || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 text-[#8B7A9C]">{row.orders_count ?? 0}</td>
                    <td className="px-4 py-2.5 text-right">{formatNGN(row.gross || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-[#A95400]">−{formatNGN(row.commission || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-[#A95400]">−{formatNGN(row.deductions || 0)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-[#2B0B4D]">{formatNGN(row.net || 0)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                        }`}
                      >
                        {row.status === "paid" ? "Paid" : "Pending"}
                      </span>
                      {row.reference && <p className="mt-0.5 text-[10.5px] text-[#9A8CA8]">{row.reference}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}