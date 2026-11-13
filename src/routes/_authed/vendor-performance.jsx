import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { vendorMonthlyInsights } from "@/lib/insight-fns";
import { formatNGN } from "@/lib/avora";
import { Star, TrendingUp, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-performance")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, data: null };
    return { context, data: await vendorMonthlyInsights() };
  },
  head: () => ({ meta: [{ title: "Vendor performance · AVORA" }] }),
  component: VendorPerformance,
});

function VendorPerformance() {
  const { context, data } = Route.useLoaderData();

  if (!data?.store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="performance" badge="Vendor console" title="Performance" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const { store, months, topProducts, totals } = data;
  const chartMonths = months.map((month) => ({ ...month, rating: month.rating ?? null }));
  const best = [...months].sort((a, b) => b.sales - a.sales)[0];

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="performance"
      badge="Vendor console"
      title="Monthly performance"
      subtitle={`${store.name} · rating and revenue trend`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="This month" value={formatNGN(months[months.length - 1]?.sales ?? 0)} hint={`${months[months.length - 1]?.orders ?? 0} orders`} icon={TrendingUp} tone="green" />
        <StatCard label="Best month" value={best ? `${best.month} ${formatNGN(best.sales)}` : "—"} hint="Highest delivered revenue" icon={Trophy} tone="purple" />
        <StatCard label="Rating" value={totals.rating ?? "—"} hint={`${totals.rated} ratings`} icon={Star} tone="orange" />
        <StatCard label="Avg. order" value={formatNGN(totals.avgOrder)} hint={`${totals.delivered} delivered`} icon={TrendingUp} tone="blue" />
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Customer rating trend</h2>
        <p className="text-[11.5px] text-[#9A8CA8]">Average rating per month, out of 5</p>
        <div className="mt-3 h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartMonths} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A8CA8" }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: "#9A8CA8" }} />
              <Tooltip formatter={(value) => (value ? `${value} / 5` : "No ratings")} />
              <Line type="monotone" dataKey="rating" stroke="#FF7A00" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Month by month</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-[10.5px] uppercase tracking-[0.1em] text-[#A797B4]">
                <tr>
                  <th className="pb-2">Month</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Sales</th>
                  <th className="pb-2 text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECF9]">
                {[...months].reverse().map((month) => (
                  <tr key={month.key}>
                    <td className="py-2 font-semibold text-[#1B1024]">{month.month}</td>
                    <td className="py-2 text-right text-[#5B4A6B]">{month.orders}</td>
                    <td className="py-2 text-right font-semibold text-[#2B0B4D]">{formatNGN(month.sales)}</td>
                    <td className="py-2 text-right text-[#5B4A6B]">{month.rating ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Top-performing items</h2>
          {topProducts.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No sales yet" description="Delivered orders build this list automatically." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {topProducts.slice(0, 6).map((product) => (
                <li key={product.name} className="flex items-center justify-between gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#1B1024]">{product.name}</span>
                  <span className="text-[11.5px] text-[#9A8CA8]">{product.qty} sold</span>
                  <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(product.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}