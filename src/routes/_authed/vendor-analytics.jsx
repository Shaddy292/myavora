import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { formatDateTime, formatNGN } from "@/lib/avora";
import { Clock, Coins, Flame, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-analytics")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, data: null };
    return { context, data: await vendorMonthlyInsights() };
  },
  head: () => ({ meta: [{ title: "Vendor analytics · AVORA" }] }),
  component: VendorAnalytics,
});

function VendorAnalytics() {
  const { context, data } = Route.useLoaderData();

  if (!data?.store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="monthly" badge="Vendor console" title="Monthly analytics" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const { store, totals, topProducts, months, recentPrep } = data;

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="monthly"
      badge="Vendor console"
      title="Sales & kitchen speed"
      subtitle={`${store.name} · last 6 months`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total sales" value={formatNGN(totals.sales)} hint={`${totals.delivered} delivered`} icon={Coins} tone="green" />
        <StatCard label="Orders" value={totals.orders} hint={`Avg ${formatNGN(totals.avgOrder)}`} icon={ShoppingBag} tone="purple" />
        <StatCard
          label="Avg. prep"
          value={totals.avgPrep === null ? "—" : `${totals.avgPrep} min`}
          hint={totals.fastestPrep === null ? "No prep data yet" : `Fastest ${totals.fastestPrep} min`}
          icon={Clock}
          tone="orange"
        />
        <StatCard label="Rating" value={totals.rating ?? "—"} hint={`${totals.rated} customer ratings`} icon={Flame} tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Monthly sales</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Delivered revenue per month</p>
          <div className="mt-3 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A8CA8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <Tooltip formatter={(value) => formatNGN(value)} />
                <Bar dataKey="sales" fill="#4B2080" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Kitchen prep times</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Accepted → ready for pickup</p>
          {recentPrep.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-[#8B7A9C]">
              Prep times appear once a few orders move through your kitchen.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentPrep.map((row) => (
                <li key={row.id} className="flex items-center justify-between rounded-xl bg-[#FBF8F3] px-3 py-2">
                  <span className="text-[12.5px] font-semibold text-[#1B1024]">{row.code}</span>
                  <span className="text-[11px] text-[#9A8CA8]">{formatDateTime(row.at)}</span>
                  <span className="text-[12.5px] font-bold text-[#B05C00]">{row.minutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Most popular items</h2>
        {topProducts.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No sales yet" description="Your best sellers appear here once orders are delivered." />
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {topProducts.map((product, index) => (
              <li key={product.name} className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[12px] font-bold text-[#4B2080]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#1B1024]">{product.name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">{product.qty} sold</p>
                </div>
                <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(product.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}