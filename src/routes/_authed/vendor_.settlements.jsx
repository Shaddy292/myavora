import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { getConsoleContext, runSettlements } from "@/lib/avora-fns";
import { vendorFeeSummary } from "@/lib/finance-fns";
import { formatNGN } from "@/lib/avora";
import { Wallet, TrendingUp, Percent, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor_/settlements")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, settlements: [], orders: [], fees: null };
    const [settlements, orders, fees] = await Promise.all([
      db.entities.Settlement.filter(
        { subject_email: context.user.email },
        { sort: "-created_date", limit: 30 }
      ),
      db.entities.Order.filter({ store_id: context.store.id }, { sort: "-created_date", limit: 100 }),
      vendorFeeSummary(),
    ]);
    return {
      context,
      settlements: settlements.items ?? settlements,
      orders: orders.items ?? orders,
      fees,
    };
  },
  head: () => ({ meta: [{ title: "Settlements · AVORA" }] }),
  component: VendorSettlements,
});

const NAV = [
  { key: "board", label: "Order board", to: "/vendor" },
  { key: "menu", label: "Menu & stock", to: "/vendor/menu" },
  { key: "products", label: "Inventory", to: "/vendor-products" },
  { key: "analytics", label: "Analytics", to: "/vendor-dashboard" },
  { key: "settlements", label: "Settlements", to: "/vendor/settlements" },
];

function VendorSettlements() {
  const { context, settlements, orders, fees } = Route.useLoaderData();
  const router = useRouter();
  const generate = useServerFn(runSettlements);
  const [busy, setBusy] = useState(false);
  const store = context.store;

  if (!store) {
    return (
      <ConsoleShell nav={NAV} active="settlements" badge="Vendor console" title="Settlements" role={context.role}>
        <EmptyState title="No store yet" description="Open a store to see your statements here." />
      </ConsoleShell>
    );
  }

  const delivered = orders.filter((o) => o.status === "delivered");
  const gross = delivered.reduce((s, o) => s + (o.subtotal || 0), 0);
  const commission = Math.round(gross * (store.commission_rate ?? 0.1));
  const paid = settlements.filter((s) => s.status === "paid").reduce((s, x) => s + x.net, 0);
  const pending = settlements.filter((s) => s.status === "pending").reduce((s, x) => s + x.net, 0);

  const run = async () => {
    setBusy(true);
    try {
      await generate({ data: { days: 7 } });
      toast.success("Statement generated for the last 7 days");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not generate a statement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={NAV}
      active="settlements"
      badge="Vendor console"
      title="Settlements"
      subtitle={`${store.name} · ${Math.round((store.commission_rate ?? 0.1) * 100)}% AVORA commission · ${formatNGN(fees?.fees.monthlyFee ?? 2000)}/month`}
      role={context.role}
      actions={
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate statement"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivered sales" value={formatNGN(gross)} icon={TrendingUp} tone="green" hint={`${delivered.length} orders`} />
        <StatCard label="AVORA commission" value={formatNGN(commission)} icon={Percent} tone="orange" hint="Deducted from payouts" />
        <StatCard label="Paid out" value={formatNGN(paid)} icon={Wallet} tone="purple" hint="Settled to your account" />
        <StatCard label="Awaiting payout" value={formatNGN(pending)} icon={ReceiptText} tone="blue" hint="Pending statements" />
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Account fees</h2>
            <p className="text-[11.5px] text-[#9A8CA8]">
              One-off joining fee plus {formatNGN(fees?.fees.monthlyFee ?? 2000)} a month, deducted
              automatically from your payouts.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              fees?.joinPaid ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
            }`}
          >
            {fees?.joinPaid ? "Joining fee settled" : "Joining fee outstanding"}
          </span>
        </div>

        <ul className="mt-3 divide-y divide-[#F3ECF9]">
          {(fees?.charges ?? []).slice(0, 6).map((charge) => (
            <li key={charge.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-[#1B1024]">
                  {charge.kind === "join_fee"
                    ? "Joining & registration fee"
                    : `Monthly platform fee · ${charge.period}`}
                </p>
                <p className="text-[11px] text-[#9A8CA8]">
                  {charge.reference}
                  {charge.due_date ? ` · due ${charge.due_date}` : ""}
                </p>
              </div>
              <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(charge.amount)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  charge.status === "paid"
                    ? "bg-[#E7F6EC] text-[#15693F]"
                    : charge.status === "waived"
                      ? "bg-[#F4EEFA] text-[#5B3C7A]"
                      : "bg-[#FFF4E3] text-[#A95400]"
                }`}
              >
                {charge.status === "paid" ? "Paid" : charge.status === "waived" ? "Waived" : "Due"}
              </span>
            </li>
          ))}
          {(fees?.charges ?? []).length === 0 && (
            <li className="py-3 text-[12px] text-[#9A8CA8]">No fees raised on your store yet.</li>
          )}
        </ul>

        {fees?.due > 0 && (
          <p className="mt-2 rounded-xl bg-[#FFF6EA] px-3 py-2 text-[11.5px] text-[#8A5200]">
            {formatNGN(fees.due)} outstanding — cleared from your next settlement payout.
          </p>
        )}
      </section>

      <div className="mt-5 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
          Statements
        </h2>
        {settlements.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No statements yet"
              description="Generate a statement to reconcile your delivered orders for the period."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {settlements.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1B1024]">
                    {row.period_start} → {row.period_end}
                  </p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {row.orders_count} orders · ref {row.reference}
                  </p>
                </div>
                <span className="text-[12px] text-[#8B7A9C]">
                  gross {formatNGN(row.gross)} · fee {formatNGN(row.commission)}
                  {row.deductions > 0 ? ` · platform fees ${formatNGN(row.deductions)}` : ""}
                </span>
                <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(row.net)}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                  }`}
                >
                  {row.status === "paid" ? "Paid" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConsoleShell>
  );
}