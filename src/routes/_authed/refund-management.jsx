import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { formatDateTime, formatNGN } from "@/lib/avora";
import { listMyOrders } from "@/lib/order-fns";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, Receipt, RotateCcw, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authed/refund-management")({
  loader: async () => {
    const [me, refunds, orders] = await Promise.all([
      db.auth.me(),
      db.entities.Refund.list("-created_date", 50),
      listMyOrders(),
    ]);
    return { me, refunds, orders: orders.filter((order) => order.status === "delivered") };
  },
  head: () => ({ meta: [{ title: "Refund requests · AVORA" }] }),
  component: RefundManagement,
});

const STEPS = ["requested", "approved", "processed"];
const LABEL = {
  requested: "Requested",
  approved: "Approved",
  processed: "Refunded",
  rejected: "Rejected",
};

function RefundManagement() {
  const { me, refunds, orders } = Route.useLoaderData();
  const router = useRouter();
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [amount, setAmount] = useState(String(orders[0]?.total ?? ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const order = orders.find((row) => row.id === orderId);
  const claimed = new Set(refunds.map((refund) => refund.order_id));
  const claimable = orders.filter((row) => !claimed.has(row.id));

  const submit = async (event) => {
    event.preventDefault();
    if (!order) {
      toast.error("Choose a delivered order first");
      return;
    }
    const value = Math.round(Number(amount));
    if (!value || value <= 0 || value > Math.round(order.total)) {
      toast.error(`Enter an amount between ₦1 and ${formatNGN(order.total)}`);
      return;
    }
    setBusy(true);
    try {
      await db.entities.Refund.create({
        order_id: order.id,
        order_code: order.code,
        customer_email: me.email,
        amount: value,
        reason: reason.trim(),
        status: "requested",
        requested_by: me.email,
      });
      setReason("");
      toast.success("Refund request submitted");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not submit the refund request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Refund requests</h1>
      <p className="text-[13px] text-[#8B7A9C]">Claim on a delivered order and follow it until the money is back.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
            <RotateCcw className="h-4 w-4 text-[#4B2080]" /> New claim
          </h2>
          {claimable.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[#8B7A9C]">
              {orders.length === 0
                ? "You have no delivered orders yet — refunds open once an order is delivered."
                : "Every delivered order already has a refund claim."}
            </p>
          ) : (
            <>
              <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A8CA8]">Order</label>
              <FieldSelect
                value={orderId}
                onChange={(value) => {
                  setOrderId(value);
                  const next = orders.find((row) => row.id === value);
                  setAmount(String(next?.total ?? ""));
                }}
                options={claimable.map((row) => ({
                  value: row.id,
                  label: `${row.code} · ${row.store_name} · ${formatNGN(row.total)}`,
                }))}
              />

              <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A8CA8]">
                Amount to refund
              </label>
              <input
                type="number"
                min="1"
                max={order ? Math.round(order.total) : undefined}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] font-semibold text-[#2B0B4D] outline-none focus:border-[#4B2080]"
              />
              {order && (
                <p className="mt-1 text-[11px] text-[#9A8CA8]">
                  Paid {formatNGN(order.total)} · {order.payment_method === "cash" ? "cash" : "card"} ·{" "}
                  {order.delivered_at ? formatDateTime(order.delivered_at) : "delivered"}
                </p>
              )}

              <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A8CA8]">
                What went wrong?
              </label>
              <textarea
                required
                rows={4}
                minLength={5}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Missing item, cold food, wrong order…"
                className="mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-[#FF7A00] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit refund request"}
              </button>
            </>
          )}
        </form>

        <section>
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Your claims</h2>
          {refunds.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No claims yet" description="Refund requests you open will be tracked here with their decision." />
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {refunds.map((refund) => {
                const rejected = refund.status === "rejected";
                const reached = rejected ? 1 : STEPS.indexOf(refund.status) + 1;
                return (
                  <li key={refund.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1B1024]">
                          <Receipt className="h-3.5 w-3.5 text-[#4B2080]" /> {refund.order_code || refund.order_id}
                        </p>
                        <p className="text-[11.5px] text-[#9A8CA8]">{formatDateTime(refund.created_date)}</p>
                      </div>
                      <span className="text-[14px] font-extrabold text-[#2B0B4D]">{formatNGN(refund.amount)}</span>
                    </div>

                    <p className="mt-1.5 text-[12.5px] text-[#5B4A6B]">{refund.reason}</p>

                    <ol className="mt-3 flex items-center gap-1.5">
                      {STEPS.map((step, index) => {
                        const done = !rejected && index < reached;
                        return (
                          <li key={step} className="flex flex-1 items-center gap-1.5">
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                                done ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#F4EEFA] text-[#B5A7C2]"
                              )}
                            >
                              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <span className={cn("text-[11px] font-semibold", done ? "text-[#15693F]" : "text-[#9A8CA8]")}>
                              {LABEL[step]}
                            </span>
                            {index < STEPS.length - 1 && (
                              <span className={cn("h-px flex-1", done ? "bg-[#C6EAD3]" : "bg-[#EFE7F6]")} />
                            )}
                          </li>
                        );
                      })}
                    </ol>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                      {rejected ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#FDECEC] px-2.5 py-1 font-bold text-[#A11D1D]">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      ) : refund.status === "processed" ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#E7F6EC] px-2.5 py-1 font-bold text-[#15693F]">
                          <CheckCircle2 className="h-3 w-3" /> Money refunded
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-[#FFF4E3] px-2.5 py-1 font-bold text-[#A95400]">
                          <Clock3 className="h-3 w-3" /> With the finance team
                        </span>
                      )}
                      {refund.decided_by && <span className="text-[#9A8CA8]">Handled by {refund.decided_by}</span>}
                    </div>
                    {refund.note && (
                      <p className="mt-2 rounded-xl bg-[#FBF8F3] px-3 py-2 text-[11.5px] italic text-[#5B4A6B]">
                        “{refund.note}”
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-[#9A8CA8]">
            Need help with a claim? <Link to="/support" className="font-bold text-[#3B0A66]">Message support</Link>.
          </p>
        </section>
      </div>
    </CustomerShell>
  );
}