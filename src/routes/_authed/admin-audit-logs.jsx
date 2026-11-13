import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { adminAuditTrail } from "@/lib/insight-fns";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Search, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-audit-logs")({
  loader: async () => {
    const context = await getConsoleContext();
    const logs = context.role === "admin" ? await adminAuditTrail() : [];
    return { context, logs };
  },
  head: () => ({ meta: [{ title: "Activity logs · AVORA admin" }] }),
  component: AdminAuditLogs,
});

const CATEGORIES = [
  { key: "all", label: "Everything" },
  { key: "order.", label: "Orders" },
  { key: "vendor.", label: "Stores" },
  { key: "rider.", label: "Riders" },
  { key: "refund.", label: "Refunds" },
  { key: "settlement.", label: "Payouts" },
  { key: "staff.", label: "Users & staff" },
  { key: "ticket.", label: "Support" },
  { key: "content.", label: "Content" },
];

const TONE = {
  critical: "bg-[#FDECEC] text-[#A11D1D] ring-[#F7CDCD]",
  warning: "bg-[#FFF4E3] text-[#A95400] ring-[#FFE2BC]",
  info: "bg-[#F2EEF7] text-[#5B4A6B] ring-[#E4D9EE]",
};

function AdminAuditLogs() {
  const { context, logs } = Route.useLoaderData();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesCategory = category === "all" || String(log.action).startsWith(category);
      const matchesQuery =
        !term || `${log.action} ${log.target ?? ""} ${log.detail ?? ""} ${log.actor_email}`.toLowerCase().includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [logs, category, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const log of visible) {
      const key = new Date(log.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
      map.set(key, [...(map.get(key) ?? []), log]);
    }
    return [...map.entries()];
  }, [visible]);

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="logs" badge="Operations" title="Activity logs" role={context.role}>
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
      title="Activity logs"
      subtitle={`${logs.length} events · ${critical} critical`}
      role={context.role}
    >
      <div className="rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center gap-2 rounded-full bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
          <Search className="h-4 w-4 text-[#9A8CA8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actor, store, order or action…"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORIES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setCategory(entry.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition",
                category === entry.key ? "bg-[#2B0B4D] text-white" : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No activity matches" description="Try another category or a wider search term." />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map(([day, entries]) => (
            <section key={day}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A797B4]">{day}</h2>
              <ul className="mt-2 divide-y divide-[#F3ECF9] overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
                {entries.map((log) => (
                  <li key={log.id} className="flex flex-wrap items-start gap-2 px-4 py-3">
                    <span className={cn("mt-0.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", TONE[log.severity] ?? TONE.info)}>
                      {log.severity === "critical" && <ShieldAlert className="h-3 w-3" />}
                      {log.action}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-semibold text-[#1B1024]">{log.target || "System"}</p>
                      <p className="text-[11.5px] text-[#8B7A9C]">{log.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-[#5B4A6B]">{log.actor_email}</p>
                      <p className="text-[10.5px] text-[#A797B4]">{formatDateTime(log.created_date)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}