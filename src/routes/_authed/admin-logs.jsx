import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { ScrollText, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-logs")({
  loader: async () => {
    const context = await getConsoleContext();
    const logs = context.role === "admin" ? await db.entities.AuditLog.list("-created_date", 200) : [];
    return { context, logs };
  },
  head: () => ({ meta: [{ title: "Audit log · AVORA admin" }] }),
  component: AdminLogs,
});

const SEVERITIES = [
  { key: "all", label: "Everything" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
];

const TONE = {
  critical: "bg-[#FDECEC] text-[#A11D1D] ring-[#F7CDCD]",
  warning: "bg-[#FFF4E3] text-[#A95400] ring-[#FFE2BC]",
  info: "bg-[#F2EEF7] text-[#5B4A6B] ring-[#E4D9EE]",
};

function AdminLogs() {
  const { context, logs } = Route.useLoaderData();
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesSeverity = severity === "all" || (log.severity ?? "info") === severity;
      const matchesQuery =
        !term ||
        `${log.action} ${log.target ?? ""} ${log.detail ?? ""} ${log.actor_email}`.toLowerCase().includes(term);
      return matchesSeverity && matchesQuery;
    });
  }, [logs, severity, query]);

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="logs" badge="Operations" title="Audit log" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const critical = logs.filter((log) => log.severity === "critical").length;

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="logs"
      badge="Operations"
      title="Audit log"
      subtitle={`${logs.length} recorded actions · ${critical} critical`}
      role={context.role}
    >
      <div className="flex flex-wrap items-center gap-2">
        {SEVERITIES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setSeverity(entry.key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              severity === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search action, target or person"
          className="ml-auto w-full rounded-full border border-[#E4D9EE] bg-white px-3.5 py-2 text-[12.5px] outline-none focus:border-[#4B2080] sm:w-[280px]"
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No entries match"
            description="Sensitive actions — refunds, verification decisions, staff changes, payouts — are recorded here automatically."
          />
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {visible.map((log) => (
            <li key={log.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-[#EDE5F4]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#1B1024]">
                    {log.severity === "critical" ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-[#A11D1D]" />
                    ) : (
                      <ScrollText className="h-3.5 w-3.5 text-[#4B2080]" />
                    )}
                    {log.action}
                  </p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {log.actor_email} → {log.target || "platform"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1",
                      TONE[log.severity ?? "info"]
                    )}
                  >
                    {log.severity ?? "info"}
                  </span>
                  <span className="text-[11px] text-[#9A8CA8]">{formatDateTime(log.created_date)}</span>
                </div>
              </div>
              {log.detail && <p className="mt-1.5 text-[12px] leading-relaxed text-[#5B4A6B]">{log.detail}</p>}
            </li>
          ))}
        </ol>
      )}
    </ConsoleShell>
  );
}