import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import {
  adminFinance,
  decideRefund,
  getConsoleContext,
  markSettlementPaid,
  runSettlements,
} from "@/lib/avora-fns";
import {
  recordVendorChargePaid,
  runVendorBilling,
  vendorFeeBoard,
  waiveVendorCharge,
} from "@/lib/finance-fns";
import VendorFeesBoard from "@/components/avora/admin/VendorFeesBoard";
import { ADMIN_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { CreditCard, Banknote, Percent, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authed/admin_/finance")({
  loader: async () => {
    const context = await getConsoleContext();
    try {
      const [data, fees] = await Promise.all([adminFinance(), vendorFeeBoard()]);
      return { context, data, fees, denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, data: null, fees: null, denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Finance · AVORA admin" }] }),
  component: AdminFinance,
});

function AdminFinance() {
  const { context, data, fees, denied } = Route.useLoaderData();
  const router = useRouter();
  const refund = useServerFn(decideRefund);
  const pay = useServerFn(markSettlementPaid);
  const generate = useServerFn(runSettlements);
  const payCharge = useServerFn(recordVendorChargePaid);
  const waiveCharge = useServerFn(waiveVendorCharge);
  const runBilling = useServerFn(runVendorBilling);
  const [busy, setBusy] = useState(false);

  if (denied) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="finance" badge="Operations" title="Finance" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="finance"
      badge="Operations"
      title="Finance & reconciliation"
      subtitle="Every naira traced from checkout to payout"
      role={context.role}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => generate({ data: { days: 7 } }), "Statements generated")}
          className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          Generate statements
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Card collected" value={formatNGN(data.card)} icon={CreditCard} tone="blue" hint="Verified payments" />
        <StatCard label="Cash collected" value={formatNGN(data.cash)} icon={Banknote} tone="green" hint="Rider reconciliation" />
        <StatCard label="Commission" value={formatNGN(data.commission)} icon={Percent} tone="purple" hint={`${data.fees.vendorPct}% vendor · ${data.fees.riderPct}% rider`} />
        <StatCard label="Refunded" value={formatNGN(data.refunded)} icon={Undo2} tone="red" hint="Approved refunds" />
      </div>

      <VendorFeesBoard
        board={fees}
        busy={busy}
        onPay={(charge) =>
          act(() => payCharge({ data: { charge_id: charge.id } }), `${charge.store_name} fee recorded`)
        }
        onWaive={(charge) =>
          act(() => waiveCharge({ data: { charge_id: charge.id } }), "Charge waived")
        }
        onRun={() =>
          act(async () => {
            const result = await runBilling();
            return result;
          }, "Monthly billing run")
        }
      />

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Refund requests</h2>
        {data.refunds.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No refunds waiting" description="Customer refund requests appear here for approval." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.refunds.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1B1024]">
                    {row.order_code || row.order_id} · {formatNGN(row.amount)}
                  </p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {row.reason} · {row.customer_email}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => refund({ data: { refund_id: row.id, decision: "approve" } }),
                      "Refund processed"
                    )
                  }
                  className="rounded-full bg-[#1F7A4C] px-3.5 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(() => refund({ data: { refund_id: row.id, decision: "reject" } }), "Refund rejected")
                  }
                  className="rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] disabled:opacity-60"
                >
                  Reject
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.mismatches.length > 0 && (
        <section className="mt-4 rounded-2xl bg-[#FFF6EA] p-4 ring-1 ring-[#FBE3C4]">
          <h2 className="font-display text-[14px] font-bold text-[#8A5200]">
            {data.mismatches.length} delivered orders without a matching payment
          </h2>
          <ul className="mt-2 space-y-1 text-[12px] text-[#8A5200]">
            {data.mismatches.slice(0, 5).map((order) => (
              <li key={order.id}>
                {order.code} · {order.store_name} · {formatNGN(order.total)} · {order.payment_status}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Payments
          </h2>
          <div className="max-h-[340px] overflow-y-auto">
            <ul className="divide-y divide-[#F3ECF9]">
              {data.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{payment.order_code}</p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {payment.method} · {formatDateTime(payment.created_date)}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(payment.amount)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      ["paid", "cash_collected"].includes(payment.status)
                        ? "bg-[#E7F6EC] text-[#15693F]"
                        : payment.status === "refunded"
                          ? "bg-[#FDECEC] text-[#A11D1D]"
                          : "bg-[#FFF4E3] text-[#A95400]"
                    }`}
                  >
                    {payment.status}
                  </span>
                </li>
              ))}
              {data.payments.length === 0 && (
                <li className="px-4 py-6 text-center text-[12.5px] text-[#9A8CA8]">No payments recorded yet.</li>
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          <h2 className="font-display border-b border-[#F3ECF9] px-4 py-3 text-[15px] font-bold text-[#1B1024]">
            Partner settlements
          </h2>
          <div className="max-h-[340px] overflow-y-auto">
            <ul className="divide-y divide-[#F3ECF9]">
              {data.settlements.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{row.subject_name}</p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {row.subject_type} · {row.orders_count} orders · {row.reference}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(row.net)}</span>
                  {row.status === "paid" ? (
                    <span className="rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[10.5px] font-bold text-[#15693F]">
                      Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(() => pay({ data: { settlement_id: row.id } }), "Settlement marked paid")
                      }
                      className="rounded-full bg-[#2B0B4D] px-2.5 py-1 text-[10.5px] font-bold text-white disabled:opacity-60"
                    >
                      Mark paid
                    </button>
                  )}
                </li>
              ))}
              {data.settlements.length === 0 && (
                <li className="px-4 py-6 text-center text-[12.5px] text-[#9A8CA8]">
                  No statements yet — generate them above.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}