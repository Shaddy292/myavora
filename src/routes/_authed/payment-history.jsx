import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import CustomerShell from "@/components/avora/CustomerShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { paymentLedger } from "@/lib/platform-fns";
import { formatDateTime, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Banknote, HandCoins, ReceiptText, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authed/payment-history")({
  loader: () => paymentLedger(),
  head: () => ({ meta: [{ title: "Payment history · AVORA" }] }),
  component: PaymentHistory,
});

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "order", label: "Orders" },
  { key: "payout", label: "Payouts" },
];

function PaymentHistory() {
  const { orders, settlements, store, rider } = Route.useLoaderData();
  const [filter, setFilter] = useState("all");

  const entries = useMemo(() => {
    const orderRows = orders.map((order) => ({
      id: `order-${order.id}`,
      kind: "order",
      at: order.created_date,
      reference: order.code,
      label: order.store_name || "AVORA order",
      detail: `${order.items?.length ?? 0} items · ${order.payment_method === "cash" ? "Cash" : "Card"}`,
      amount: order.total || 0,
      status: order.payment_status || "pending",
    }));
    const payoutRows = settlements.map((row) => ({
      id: `payout-${row.id}`,
      kind: "payout",
      at: row.created_date,
      reference: row.reference || row.id.slice(0, 8),
      label: row.subject_type === "rider" ? "Rider payout" : "Vendor payout",
      detail: `${row.orders_count || 0} orders · ${row.period_start} → ${row.period_end}`,
      amount: row.net || 0,
      status: row.status,
    }));
    return [...orderRows, ...payoutRows]
      .filter((row) => filter === "all" || row.kind === filter)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [orders, settlements, filter]);

  const spent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const delivered = orders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + (order.total || 0), 0);
  const paidOut = settlements.filter((row) => row.status === "paid").reduce((sum, row) => sum + (row.net || 0), 0);
  const pending = settlements.filter((row) => row.status !== "paid").reduce((sum, row) => sum + (row.net || 0), 0);

  const role = store ? `Vendor · ${store.name}` : rider ? `Rider · ${rider.full_name}` : "Customer account";

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Payment history</h1>
      <p className="text-[13px] text-[#8B7A9C]">
        {role} — every transaction, payout and settlement in one ledger.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total spend" value={formatNGN(spent)} hint={`${orders.length} orders`} icon={ReceiptText} tone="purple" />
        <StatCard label="Delivered" value={formatNGN(delivered)} hint="Completed orders" icon={Banknote} tone="green" />
        <StatCard label="Paid out" value={formatNGN(paidOut)} hint="Settled to you" icon={Wallet} tone="blue" />
        <StatCard label="Pending payout" value={formatNGN(pending)} hint="Awaiting settlement" icon={HandCoins} tone="orange" />
      </div>

      <div className="mt-4 flex gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              filter === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {entries.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No transactions yet"
              description="Orders you place and payouts you receive will be listed here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[12.5px]">
              <thead className="bg-[#FBF8F3] text-[10.5px] uppercase tracking-[0.1em] text-[#A797B4]">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Reference</th>
                  <th className="px-3 py-2.5">Detail</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECF9]">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2.5 text-[#8B7A9C]">{formatDateTime(entry.at)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-[#1B1024]">{entry.reference}</p>
                      <p className="text-[11px] text-[#9A8CA8]">{entry.label}</p>
                    </td>
                    <td className="px-3 py-2.5 text-[11.5px] text-[#5B4A6B]">{entry.detail}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#2B0B4D]">{formatNGN(entry.amount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize",
                          ["paid", "cash_collected"].includes(entry.status)
                            ? "bg-[#E7F6EC] text-[#15693F]"
                            : ["refunded", "failed"].includes(entry.status)
                              ? "bg-[#FDECEC] text-[#A11D1D]"
                              : "bg-[#FFF4E3] text-[#A95400]"
                        )}
                      >
                        {String(entry.status).replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CustomerShell>
  );
}