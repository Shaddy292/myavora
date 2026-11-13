import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { adminReports, getConsoleContext, runBackup } from "@/lib/avora-fns";
import { ADMIN_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { DatabaseBackup, ShieldCheck, TrendingUp, Store } from "lucide-react";

export const Route = createFileRoute("/_authed/admin_/reports")({
  loader: async () => {
    const context = await getConsoleContext();
    try {
      return { context, data: await adminReports(), denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, data: null, denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Reports · AVORA admin" }] }),
  component: AdminReports,
});

function AdminReports() {
  const { context, data, denied } = Route.useLoaderData();
  const backup = useServerFn(runBackup);
  const [busy, setBusy] = useState(false);

  if (denied) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="reports" badge="Operations" title="Reports" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const totalGmv = data.days.reduce((s, d) => s + d.gmv, 0);
  const totalOrders = data.days.reduce((s, d) => s + d.orders, 0);
  const lastBackup = data.backups[0];

  const takeSnapshot = async () => {
    setBusy(true);
    try {
      const snapshot = await backup();
      toast.success(`Snapshot saved · ${snapshot.orders} orders, ${snapshot.stores} stores`);
      window.location.reload();
    } catch (error) {
      toast.error(error?.message || "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="reports"
      badge="Operations"
      title="Reports, backups & monitoring"
      subtitle="Last 14 days · Nigeria"
      role={context.role}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={takeSnapshot}
          className="flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          <DatabaseBackup className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Run backup"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="GMV (14 days)" value={formatNGN(totalGmv)} icon={TrendingUp} tone="green" />
        <StatCard label="Orders" value={totalOrders} icon={Store} tone="purple" />
        <StatCard label="Critical events" value={data.critical} icon={ShieldCheck} tone={data.critical ? "red" : "blue"} hint="Security monitoring" />
        <StatCard
          label="Last backup"
          value={lastBackup ? formatDateTime(lastBackup.created_date) : "None"}
          icon={DatabaseBackup}
          tone="orange"
        />
      </div>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Daily GMV</h2>
        <div className="mt-3 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.days} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#F3ECF9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A8CA8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value) => formatNGN(value)}
                contentStyle={{ borderRadius: 12, border: "1px solid #EFE7F6", fontSize: 12 }}
              />
              <Bar dataKey="gmv" fill="#4B2080" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Top stores</h2>
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.topStores.map((store) => (
              <li key={store.name} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">{store.orders} orders</p>
                </div>
                <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(store.gmv)}</span>
              </li>
            ))}
            {data.topStores.length === 0 && (
              <li className="py-4 text-center text-[12.5px] text-[#9A8CA8]">No sales recorded yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Rider performance</h2>
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.riders.map((rider) => (
              <li key={rider.name} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{rider.name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">
                    {rider.deliveries} deliveries · {rider.rating.toFixed(1)}★ · cash {formatNGN(rider.cash)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    rider.status === "approved" ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                  }`}
                >
                  {rider.status}
                </span>
              </li>
            ))}
            {data.riders.length === 0 && (
              <li className="py-4 text-center text-[12.5px] text-[#9A8CA8]">No riders registered yet.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Security & audit log</h2>
        {data.auditLogs.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Nothing logged yet" description="Approvals, refunds and payouts are recorded here." />
          </div>
        ) : (
          <ul className="mt-3 max-h-[280px] divide-y divide-[#F3ECF9] overflow-y-auto">
            {data.auditLogs.map((log) => (
              <li key={log.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    log.severity === "critical"
                      ? "bg-[#A11D1D]"
                      : log.severity === "warning"
                        ? "bg-[#FF7A00]"
                        : "bg-[#1F7A4C]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-[#1B1024]">
                    {log.action} · {log.target}
                  </p>
                  <p className="truncate text-[11.5px] text-[#8B7A9C]">{log.detail}</p>
                </div>
                <span className="shrink-0 text-[10.5px] text-[#A797B4]">{formatDateTime(log.created_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}