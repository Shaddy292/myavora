import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext, markSettlementPaid } from "@/lib/avora-fns";
import { riderPayoutBoard } from "@/lib/insight-fns";
import { formatNGN, timeAgo } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Banknote, Bike, HandCoins, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authed/rider-payouts")({
  loader: async () => {
    const context = await getConsoleContext();
    const canView = context.permissions.includes("finance.view");
    const board = canView ? await riderPayoutBoard() : null;
    return { context, canView, board };
  },
  head: () => ({ meta: [{ title: "Rider payouts · AVORA admin" }] }),
  component: RiderPayouts,
});

function RiderPayouts() {
  const { context, canView, board } = Route.useLoaderData();
  const router = useRouter();
  const pay = useServerFn(markSettlementPaid);
  const [tab, setTab] = useState("balances");
  const [busyId, setBusyId] = useState("");

  if (!canView) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="payouts" badge="Operations" title="Rider payouts" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const approve = async (settlement) => {
    setBusyId(settlement.id);
    try {
      await pay({ data: { settlement_id: settlement.id } });
      toast.success(`${formatNGN(settlement.net)} released to ${settlement.subject_name}`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not release this payout");
    } finally {
      setBusyId("");
    }
  };

  const pending = board.settlements.filter((row) => row.status === "pending");

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="payouts"
      badge="Operations"
      title="Rider payouts"
      subtitle={`${pending.length} statements awaiting approval`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Earned" value={formatNGN(board.totals.earned)} hint="All delivered trips" icon={Wallet} tone="purple" />
        <StatCard label="Paid out" value={formatNGN(board.totals.paid)} hint="Settled statements" icon={Banknote} tone="green" />
        <StatCard label="Pending" value={formatNGN(board.totals.pending)} hint="Awaiting approval" icon={HandCoins} tone="orange" />
        <StatCard label="Cash on hand" value={formatNGN(board.totals.cash)} hint="Collected by riders" icon={Bike} tone="blue" />
      </div>

      <div className="mt-4 flex gap-1.5">
        {[
          { key: "balances", label: "Rider balances" },
          { key: "statements", label: "Payout history" },
        ].map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              tab === entry.key ? "bg-[#2B0B4D] text-white" : "bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "balances" ? (
        <section className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          {board.board.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No riders yet" description="Approved riders and their earnings appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[12.5px]">
                <thead className="bg-[#FBF8F3] text-[10.5px] uppercase tracking-[0.1em] text-[#A797B4]">
                  <tr>
                    <th className="px-4 py-2.5">Rider</th>
                    <th className="px-3 py-2.5">Trips</th>
                    <th className="px-3 py-2.5 text-right">Earned</th>
                    <th className="px-3 py-2.5 text-right">Paid</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3ECF9]">
                  {board.board.map((rider) => (
                    <tr key={rider.email}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-[#1B1024]">{rider.name}</p>
                        <p className="text-[11px] text-[#9A8CA8]">{rider.email}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[#5B4A6B]">{rider.deliveries}</td>
                      <td className="px-3 py-2.5 text-right text-[#5B4A6B]">{formatNGN(rider.earned)}</td>
                      <td className="px-3 py-2.5 text-right text-[#5B4A6B]">{formatNGN(rider.paid)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-[#2B0B4D]">{formatNGN(rider.balance)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="rounded-full bg-[#F2EEF7] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#5B4A6B]">
                          {rider.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-3 space-y-2">
          {board.settlements.length === 0 ? (
            <EmptyState
              title="No payout runs yet"
              description="Generate settlements from Finance — rider statements land here for approval."
            />
          ) : (
            board.settlements.map((row) => (
              <article key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-[#EFE7F6]">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[#1B1024]">{row.subject_name || row.subject_email}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {row.reference} · {row.orders_count || 0} trips · {row.period_start} → {row.period_end}
                  </p>
                </div>
                <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(row.net)}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-bold",
                    row.status === "paid" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                  )}
                >
                  {row.status === "paid" ? `Paid ${timeAgo(row.updated_date)}` : "Awaiting approval"}
                </span>
                {row.status !== "paid" && (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => approve(row)}
                    className="rounded-xl bg-[#1F7A4C] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#1A6A42] disabled:opacity-60"
                  >
                    {busyId === row.id ? "Releasing…" : "Approve payout"}
                  </button>
                )}
              </article>
            ))
          )}
        </section>
      )}
    </ConsoleShell>
  );
}