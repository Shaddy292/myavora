import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import StatCard from "@/components/avora/StatCard";
import RefundReviewItem from "@/components/avora/admin/RefundReviewItem";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, RotateCcw, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-refunds")({
  loader: async () => {
    const [context, refunds] = await Promise.all([
      getConsoleContext(),
      db.entities.Refund.list("-created_date", 100),
    ]);
    return { context, refunds };
  },
  head: () => ({ meta: [{ title: "Refund requests · AVORA admin" }] }),
  component: AdminRefunds,
});

const FILTERS = [
  { key: "requested", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "processed", label: "Refunded" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function AdminRefunds() {
  const { context, refunds } = Route.useLoaderData();
  const router = useRouter();
  const [filter, setFilter] = useState("requested");
  const [busy, setBusy] = useState(false);

  const counts = useMemo(
    () => ({
      requested: refunds.filter((row) => row.status === "requested").length,
      approved: refunds.filter((row) => row.status === "approved").length,
      processed: refunds.filter((row) => row.status === "processed").length,
      rejected: refunds.filter((row) => row.status === "rejected").length,
    }),
    [refunds]
  );

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="refunds" badge="Finance" title="Refund requests" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const visible = filter === "all" ? refunds : refunds.filter((row) => row.status === filter);
  const pendingValue = refunds
    .filter((row) => row.status === "requested")
    .reduce((sum, row) => sum + (row.amount || 0), 0);

  const decide = async (refund, status, note) => {
    setBusy(true);
    try {
      await db.entities.Refund.update(refund.id, {
        status,
        note: note.trim(),
        decided_by: context.user.email,
      });
      toast.success(
        status === "approved" ? "Refund approved" : status === "processed" ? "Marked as refunded" : "Refund rejected"
      );
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update that refund");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="refunds"
      badge="Finance"
      title="Refund requests"
      subtitle={`${counts.requested} waiting on a decision`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending" value={counts.requested} hint={formatNGN(pendingValue)} icon={Clock3} tone="orange" />
        <StatCard label="Approved" value={counts.approved} hint="Awaiting payout" icon={CheckCircle2} tone="green" />
        <StatCard label="Refunded" value={counts.processed} hint="Money returned" icon={Wallet} tone="blue" />
        <StatCard label="Rejected" value={counts.rejected} hint="Closed claims" icon={RotateCcw} tone="purple" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-bold transition",
              filter === item.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {item.label}
            {item.key !== "all" && counts[item.key] > 0 ? ` · ${counts[item.key]}` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nothing in this pile"
            description="Refund claims from customers land here for approval."
          />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {visible.map((refund) => (
            <RefundReviewItem key={refund.id} refund={refund} busy={busy} onDecide={decide} />
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}