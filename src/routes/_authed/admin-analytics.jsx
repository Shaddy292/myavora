import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import { ADMIN_NAV } from "@/lib/console-nav";
import { adminAnalytics, getConsoleContext } from "@/lib/avora-fns";
import { ORDER_STATUS, formatNGN } from "@/lib/avora";
import { Bike, ShoppingBag, Store, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-analytics")({
  loader: async () => {
    const context = await getConsoleContext();
    try {
      return { context, data: await adminAnalytics(), denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, data: null, denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Platform analytics · AVORA admin" }] }),
  component: AdminAnalytics,
});

const PIE_COLORS = ["#4B2080", "#FF7A00", "#1F7A4C", "#2E3A9E", "#B05C00", "#A11D1D", "#8B7A9C", "#C9A227", "#6B4FA0"];

function AdminAnalytics() {
  const { context, data, denied } = Route.useLoaderData();

  if (denied) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="analytics" badge="Operations" title="Platform analytics" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const { totals, days, months, statusMix, topStores } = data;

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="analytics"
      badge="Operations"
      title="Platform analytics"
      subtitle="Sales, demand and growth across Nigeria"
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total sales" value={formatNGN(totals.gmv)} hint={`${totals.avgOrder ? formatNGN(totals.avgOrder) : "₦0"} avg order`} icon={TrendingUp} tone="green" />
        <StatCard label="Orders" value={totals.orders} hint={`${totals.active} active now`} icon={ShoppingBag} tone="purple" />
        <StatCard label="Customers" value={totals.customers} hint="Unique buyers" icon={Users} tone="blue" />
        <StatCard label="Live partners" value={`${totals.stores} / ${totals.ridersOnline}`} hint="Stores / riders online" icon={Bike} tone="orange" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Sales over time</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Delivered GMV, last 14 days</p>
          <div className="mt-3 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <Tooltip formatter={(value) => formatNGN(value)} />
                <Bar dataKey="gmv" fill="#4B2080" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Order status mix</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">All orders ever placed</p>
          <div className="mt-1 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusMix} dataKey="count" nameKey="status" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {statusMix.map((entry, index) => (
                    <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, ORDER_STATUS[name]?.label ?? name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-[#5B4A6B]">
            {statusMix.map((entry, index) => (
              <li key={entry.status} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                {ORDER_STATUS[entry.status]?.label ?? entry.status} · {entry.count}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Platform growth</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">New customers per month</p>
          <div className="mt-3 h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={{ top: 4, right: 6, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8CA8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="customers" stroke="#1F7A4C" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="orders" stroke="#FF7A00" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex gap-4 text-[11px] text-[#5B4A6B]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1F7A4C]" /> New customers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF7A00]" /> Orders
            </span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
            <Store className="h-4 w-4 text-[#4B2080]" /> Top stores by GMV
          </h2>
          <ul className="mt-3 space-y-2">
            {topStores.map((store, index) => (
              <li key={store.name} className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[12px] font-bold text-[#4B2080]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11px] text-[#9A8CA8]">{store.orders} orders</p>
                </div>
                <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(store.gmv)}</span>
              </li>
            ))}
            {topStores.length === 0 && <li className="text-[12px] text-[#9A8CA8]">No orders yet.</li>}
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}