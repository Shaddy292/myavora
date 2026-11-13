import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
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
import { vendorInsights } from "@/lib/order-fns";
import { formatNGN } from "@/lib/avora";
import { Coins, Package, ShoppingBag, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-dashboard")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, data: null };
    return { context, data: await vendorInsights() };
  },
  head: () => ({ meta: [{ title: "Vendor analytics · AVORA" }] }),
  component: VendorDashboard,
});

function VendorDashboard() {
  const { context, data } = Route.useLoaderData();

  if (!data?.store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="analytics" badge="Vendor console" title="Analytics" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const { store, totals, days, topProducts } = data;

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="analytics"
      badge="Vendor console"
      title="Store analytics"
      subtitle={`${store.name} · last 14 days`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales" value={formatNGN(totals.sales)} hint="Delivered orders" icon={Coins} tone="green" />
        <StatCard label="Orders" value={totals.orders} hint={`${totals.live} live now`} icon={ShoppingBag} tone="purple" />
        <StatCard label="Avg. order" value={formatNGN(totals.avgOrder)} hint={`${totals.delivered} delivered`} icon={TrendingUp} tone="orange" />
        <StatCard label="Items" value={totals.products} hint="In your menu" icon={Package} tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Sales trend</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Delivered revenue per day</p>
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="vendorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1F7A4C" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1F7A4C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <Tooltip formatter={(value) => formatNGN(value)} />
                <Area type="monotone" dataKey="sales" stroke="#1F7A4C" strokeWidth={2} fill="url(#vendorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Order volume</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Orders received per day</p>
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#4B2080" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Top performing products</h2>
        {topProducts.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No sales yet" description="Your best sellers appear here once orders are delivered." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {topProducts.map((product) => (
              <li key={product.name} className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[13px] font-bold text-[#4B2080]">
                  {product.qty}
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