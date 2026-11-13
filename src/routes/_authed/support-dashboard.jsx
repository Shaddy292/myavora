import { createFileRoute, Link } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import StatCard from "@/components/avora/StatCard";
import TicketQueueRow from "@/components/avora/support/TicketQueueRow";
import TopicBreakdown from "@/components/avora/support/TopicBreakdown";
import DisputeRow from "@/components/avora/support/DisputeRow";
import { SUPPORT_NAV } from "@/lib/console-nav";
import { getConsoleContext, supportDashboard } from "@/lib/avora-fns";
import { formatDateTime, formatNGN } from "@/lib/avora";
import { AlertTriangle, CheckCircle2, Inbox, Scale } from "lucide-react";

export const Route = createFileRoute("/_authed/support-dashboard")({
  loader: async () => {
    const context = await getConsoleContext();
    const isStaff = context.permissions.includes("support.manage");
    const board = isStaff ? await supportDashboard() : null;
    return { context, isStaff, board };
  },
  head: () => ({ meta: [{ title: "Support dashboard · AVORA" }] }),
  component: SupportDashboard,
});

function Panel({ title, hint, action, children }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3ECF9] px-4 py-3">
        <div>
          <h2 className="font-display text-[14.5px] font-bold text-[#1B1024]">{title}</h2>
          {hint && <p className="text-[11.5px] text-[#9A8CA8]">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SupportDashboard() {
  const { context, isStaff, board } = Route.useLoaderData();

  if (!isStaff) {
    return (
      <ConsoleShell nav={SUPPORT_NAV} active="support" badge="Support" title="Support dashboard" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const { stats, queue, topics, disputes, troubled } = board;

  return (
    <ConsoleShell
      nav={SUPPORT_NAV}
      active="support"
      badge="Support"
      title="Support dashboard"
      subtitle={`${stats.open} open requests · ${stats.unassigned} unassigned`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open requests" value={stats.open} hint={`${stats.totalTickets} total this period`} icon={Inbox} tone="purple" />
        <StatCard
          label="Urgent & high"
          value={stats.urgent + stats.high}
          hint={`${stats.urgent} urgent`}
          icon={AlertTriangle}
          tone="red"
        />
        <StatCard
          label="Disputes pending"
          value={stats.disputes}
          hint={stats.disputes ? `${formatNGN(stats.disputeValue)} claimed` : "Nothing waiting"}
          icon={Scale}
          tone="orange"
        />
        <StatCard label="Cleared today" value={stats.clearedToday} hint="Answered or closed" icon={CheckCircle2} tone="green" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Panel
            title="Needs a reply"
            hint="Open requests, urgent first then oldest"
            action={
              <Link to="/support-tickets" className="text-[11.5px] font-bold text-[#4B2080] hover:text-[#2B0B4D]">
                Open queue
              </Link>
            }
          >
            {queue.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Queue is clear" description="Every help request has been answered." />
              </div>
            ) : (
              <ul className="divide-y divide-[#F3ECF9]">
                {queue.map((ticket) => (
                  <TicketQueueRow key={ticket.id} ticket={ticket} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Order disputes"
            hint="Refund requests waiting on a decision"
            action={
              <Link to="/admin-refunds" className="text-[11.5px] font-bold text-[#4B2080] hover:text-[#2B0B4D]">
                Refund reviews
              </Link>
            }
          >
            {disputes.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-[#9A8CA8]">No disputes waiting for a decision.</p>
            ) : (
              <ul className="divide-y divide-[#F3ECF9]">
                {disputes.map((refund) => (
                  <DisputeRow key={refund.id} refund={refund} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Cancelled & failed orders" hint={`${stats.troubledThisWeek} in the last 7 days`}>
            {troubled.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-[#9A8CA8]">No cancellations or failures to look into.</p>
            ) : (
              <ul className="divide-y divide-[#F3ECF9]">
                {troubled.map((order) => (
                  <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#1B1024]">
                        {order.code} · {order.store_name || "Store"}
                      </p>
                      <p className="truncate text-[11.5px] text-[#8B7A9C]">
                        {order.failure_reason || order.cancel_reason || "No reason recorded"}
                      </p>
                      <p className="text-[11px] text-[#A797B4]">
                        {order.customer_email} · {formatDateTime(order.created_date)}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#A11D1D]">
                      {order.status}
                    </span>
                    <span className="text-[11.5px] font-semibold text-[#5B4A6B]">{formatNGN(order.total || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Requests by category" hint="Where the volume is coming from">
            <TopicBreakdown topics={topics} />
          </Panel>
          <Panel title="Coverage" hint="Who is holding what">
            <div className="space-y-2 px-4 py-4 text-[12.5px] text-[#5B4A6B]">
              <p className="flex items-center justify-between">
                <span>Unassigned open</span>
                <span className="font-bold text-[#1B1024]">{stats.unassigned}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>High priority open</span>
                <span className="font-bold text-[#1B1024]">{stats.high}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Dispute value pending</span>
                <span className="font-bold text-[#1B1024]">{formatNGN(stats.disputeValue)}</span>
              </p>
              <Link
                to="/help-center"
                className="mt-1 inline-block text-[11.5px] font-bold text-[#4B2080] hover:text-[#2B0B4D]"
              >
                Open the help centre
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </ConsoleShell>
  );
}