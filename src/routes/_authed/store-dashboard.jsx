import { createFileRoute, Link } from "@tanstack/react-router";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StatCard from "@/components/avora/StatCard";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { ACTIVE_STATUSES, formatNGN, timeAgo } from "@/lib/avora";
import { ChefHat, Images, Package, ShoppingBag, Store, Timer } from "lucide-react";

export const Route = createFileRoute("/_authed/store-dashboard")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, orders: [], items: 0 };
    const [ordersPage, items] = await Promise.all([
      db.entities.Order.filter({ store_id: context.store.id }, { sort: "-created_date", limit: 60 }),
      db.entities.Product.count({ store_id: context.store.id }),
    ]);
    return { context, orders: ordersPage.items ?? ordersPage, items };
  },
  head: () => ({ meta: [{ title: "Store dashboard · AVORA" }] }),
  component: StoreDashboard,
});

const QUEUE = ["placed", "accepted", "preparing"];

const SHORTCUTS = [
  { label: "Menu & stock", hint: "Availability and stock levels", to: "/vendor/menu", icon: Package },
  { label: "Inventory", hint: "Prices and item details", to: "/vendor-products", icon: ShoppingBag },
  { label: "Product photos", hint: "Replace item images", to: "/product-gallery", icon: Images },
  { label: "Store settings", hint: "Name, logo, prep times", to: "/vendor-store-settings", icon: Store },
];

function StoreDashboard() {
  const { context, orders, items } = Route.useLoaderData();
  const store = context.store;

  if (!store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="home" badge="Vendor console" title="Store dashboard" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const live = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const preparing = orders.filter((order) => order.status === "preparing");
  const ready = orders.filter((order) => order.status === "ready_for_pickup");
  const queue = orders.filter((order) => QUEUE.includes(order.status)).reverse();

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="home"
      badge="Vendor console"
      title="Store dashboard"
      subtitle={`${store.name} · ${store.is_open ? "open for orders" : "closed right now"}`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active orders" value={live.length} hint="In progress now" icon={ShoppingBag} tone="purple" />
        <StatCard label="In the kitchen" value={preparing.length} hint="Being prepared" icon={ChefHat} tone="orange" />
        <StatCard label="Ready for pickup" value={ready.length} hint="Waiting on a rider" icon={Timer} tone="blue" />
        <StatCard label="Menu items" value={items} hint="On your menu" icon={Package} tone="green" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Preparation queue</h2>
              <p className="text-[11.5px] text-[#9A8CA8]">Oldest first — clear these before new ones arrive.</p>
            </div>
            <Link to="/vendor" className="text-[11.5px] font-bold text-[#3B0A66] hover:text-[#FF7A00]">
              Order board
            </Link>
          </div>
          {queue.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Kitchen is clear" description="New orders drop into this queue the moment they're placed." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {queue.map((order) => (
                <li key={order.id} className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-[#1B1024]">
                      {order.code} · {order.items?.length ?? 0} items
                    </p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {order.customer_name || order.customer_email} · {timeAgo(order.created_date)}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                  <span className="text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Manage your store</h2>
          <ul className="mt-3 space-y-2">
            {SHORTCUTS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5 transition hover:bg-[#F4EEFA]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#4B2080] ring-1 ring-[#EFE7F6]">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-[#1B1024]">{item.label}</span>
                    <span className="block truncate text-[11px] text-[#9A8CA8]">{item.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ConsoleShell>
  );
}