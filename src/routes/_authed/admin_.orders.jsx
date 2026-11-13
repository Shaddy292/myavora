import { createFileRoute, Link } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatusPill from "@/components/avora/StatusPill";
import { adminOrders, getConsoleContext } from "@/lib/avora-fns";
import { ACTIVE_STATUSES, formatNGN, formatDateTime } from "@/lib/avora";
import { ADMIN_NAV } from "@/lib/console-nav";

const TABS = [
  { key: undefined, label: "All" },
  { key: "live", label: "Live" },
  { key: "placed", label: "New" },
  { key: "picked_up", label: "On the way" },
  { key: "delivered", label: "Delivered" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
];

export const Route = createFileRoute("/_authed/admin_/orders")({
  validateSearch: (search) => ({ status: search.status || undefined }),
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: async ({ deps }) => {
    const context = await getConsoleContext();
    try {
      return { context, orders: await adminOrders({ data: { status: deps.status } }), denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, orders: [], denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Orders · AVORA admin" }] }),
  component: AdminOrders,
});

function AdminOrders() {
  const { context, orders, denied } = Route.useLoaderData();
  const { status } = Route.useSearch();

  if (denied) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="orders" badge="Operations" title="Orders" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const rows = status === "live" ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status)) : orders;

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="orders"
      badge="Operations"
      title="All orders"
      subtitle={`${rows.length} orders in view`}
      role={context.role}
    >
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            to="/admin/orders"
            search={{ status: tab.key }}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              status === tab.key ? "bg-[#2B0B4D] text-white" : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6]"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-[#F3ECF9] text-[10.5px] uppercase tracking-[0.1em] text-[#9A8CA8]">
              <th className="px-4 py-2.5 font-semibold">Order</th>
              <th className="px-4 py-2.5 font-semibold">Store</th>
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Rider</th>
              <th className="px-4 py-2.5 font-semibold">Total</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3ECF9]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-[#9A8CA8]">
                  No orders for this filter.
                </td>
              </tr>
            )}
            {rows.map((order) => (
              <tr key={order.id} className="text-[12.5px]">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-[#1B1024]">{order.code}</p>
                  <p className="text-[11px] text-[#9A8CA8]">{formatDateTime(order.created_date)}</p>
                </td>
                <td className="px-4 py-2.5 text-[#5B4A6B]">{order.store_name}</td>
                <td className="px-4 py-2.5 text-[#5B4A6B]">{order.customer_name || order.customer_email}</td>
                <td className="px-4 py-2.5 text-[#5B4A6B]">{order.rider_name || "—"}</td>
                <td className="px-4 py-2.5 font-bold text-[#2B0B4D]">{formatNGN(order.total)}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConsoleShell>
  );
}