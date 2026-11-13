import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StatCard from "@/components/avora/StatCard";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import StoreLogoCard from "@/components/avora/console/StoreLogoCard";
import { getConsoleContext, advanceOrder } from "@/lib/avora-fns";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Inbox, ChefHat, Wallet, PackageCheck, Bell } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, orders: [], products: [] };
    const [orders, products] = await Promise.all([
      db.entities.Order.filter({ store_id: context.store.id }, { sort: "-created_date", limit: 60 }),
      db.entities.Product.filter({ store_id: context.store.id }, { sort: "name", limit: 100 }),
    ]);
    return { context, orders: orders.items ?? orders, products: products.items ?? products };
  },
  head: () => ({ meta: [{ title: "Vendor console · AVORA" }] }),
  component: VendorConsole,
});

const NAV = [
  { key: "board", label: "Order board", to: "/vendor" },
  { key: "menu", label: "Menu & stock", to: "/vendor/menu" },
  { key: "products", label: "Inventory", to: "/vendor-products" },
  { key: "analytics", label: "Analytics", to: "/vendor-dashboard" },
  { key: "settlements", label: "Settlements", to: "/vendor/settlements" },
];

const ACTIONS = {
  placed: [
    { action: "accept", label: "Accept order", tone: "bg-[#1F7A4C] hover:bg-[#1A6A42]" },
    { action: "reject", label: "Reject", tone: "bg-white text-[#A11D1D] ring-1 ring-[#F0C7C7] hover:bg-[#FDECEC]" },
  ],
  accepted: [{ action: "preparing", label: "Start preparing", tone: "bg-[#2B0B4D] hover:bg-[#3B0A66]" }],
  preparing: [{ action: "ready", label: "Mark ready for pickup", tone: "bg-[#FF7A00] hover:bg-[#F06E00]" }],
};

function VendorConsole() {
  const { context, orders, products } = Route.useLoaderData();
  const router = useRouter();
  const advance = useServerFn(advanceOrder);
  const store = context.store;

  useEffect(() => {
    if (!store) return undefined;
    return db.entities.Order.subscribe((event) => {
      if (event.type === "create" && event.data?.store_id === store.id) {
        toast.success(`New order ${event.data.code} — ${formatNGN(event.data.total)}`);
        router.invalidate();
      }
    });
  }, [store, router]);

  const board = useMemo(
    () => orders.filter((o) => ["placed", "accepted", "preparing", "ready_for_pickup"].includes(o.status)),
    [orders]
  );

  if (!context.store) {
    return (
      <ConsoleShell nav={NAV} active="board" badge="Vendor console" title="Your store" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 rounded-2xl bg-[#FFF6EA] p-4 text-[12.5px] text-[#8A5200] ring-1 ring-[#FBE3C4]">
            You don't have a store yet. Apply below — once operations approves it, this console opens with your
            orders, menu and settlements.
          </div>
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  if (!store.is_approved) {
    return (
      <ConsoleShell
        nav={NAV}
        active="board"
        badge="Vendor console"
        title={store.name}
        subtitle="Application under review"
        role={context.role}
      >
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center ring-1 ring-[#EFE7F6]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#B05C00]">
            <PackageCheck className="h-6 w-6" />
          </span>
          <h2 className="font-display mt-3 text-[18px] font-bold text-[#1B1024]">Application received</h2>
          <p className="mt-1 text-[13px] text-[#8B7A9C]">
            Our operations team is verifying <strong>{store.name}</strong>. You'll be able to publish your menu as soon
            as it's approved.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white">
            Back to dashboard
          </Link>
        </div>
      </ConsoleShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const deliveredToday = orders.filter((o) => o.status === "delivered" && o.delivered_at?.slice(0, 10) === today);
  const revenueToday = deliveredToday.reduce((s, o) => s + (o.subtotal || 0), 0);
  const lowStock = products.filter((p) => (p.stock ?? 0) <= 5);

  const run = async (orderId, action) => {
    const note = action === "reject" ? window.prompt("Reason for rejecting this order?") ?? "" : undefined;
    try {
      await advance({ data: { order_id: orderId, action, note } });
      toast.success("Order updated");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the order");
    }
  };

  return (
    <ConsoleShell
      nav={NAV}
      active="board"
      badge="Vendor console"
      title={store.name}
      subtitle={`${store.category} · ${store.area || "Nigeria"} · ${store.is_open ? "Open now" : "Closed"}`}
      role={context.role}
      actions={
        <button
          type="button"
          onClick={async () => {
            await db.entities.Store.update(store.id, { is_open: !store.is_open });
            toast.success(store.is_open ? "Store closed" : "Store opened");
            await router.invalidate();
          }}
          className="shrink-0 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#3B0A66]"
        >
          {store.is_open ? "Close store" : "Open store"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New orders" value={orders.filter((o) => o.status === "placed").length} icon={Bell} tone="orange" hint="Waiting for you" />
        <StatCard label="In prep" value={orders.filter((o) => ["accepted", "preparing"].includes(o.status)).length} icon={ChefHat} tone="purple" hint="Kitchen queue" />
        <StatCard label="Delivered today" value={deliveredToday.length} icon={PackageCheck} tone="green" hint={formatNGN(revenueToday)} />
        <StatCard label="Low stock" value={lowStock.length} icon={Wallet} tone="red" hint="5 units or fewer" />
      </div>

      <div className="mt-4">
        <StoreLogoCard
          store={store}
          onChange={async (url) => {
            await db.entities.Store.update(store.id, { logo_url: url });
            await router.invalidate();
          }}
        />
      </div>

      <h2 className="font-display mt-6 text-[16px] font-bold text-[#1B1024]">Live order board</h2>
      {board.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="No live orders"
            description="New orders appear here instantly and trigger an alert."
            action={
              <Link to="/vendor/menu" className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white">
                Manage menu
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {board.map((order) => (
            <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-[15px] font-bold text-[#1B1024]">{order.code}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">{formatDateTime(order.created_date)}</p>
                </div>
                <StatusPill status={order.status} />
              </div>
              <ul className="mt-2 space-y-1 border-y border-[#F3ECF9] py-2 text-[12.5px] text-[#5B4A6B]">
                {(order.items ?? []).map((item, i) => (
                  <li key={`${order.id}-${i}`} className="flex justify-between gap-2">
                    <span>
                      {item.qty}× {item.name}
                      {item.options?.length ? ` (${item.options.join(", ")})` : ""}
                    </span>
                    <span className="font-semibold text-[#2B0B4D]">{formatNGN(item.unit_price * item.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] font-bold text-[#1B1024]">{formatNGN(order.total)}</p>
                <div className="flex gap-2">
                  {(ACTIONS[order.status] ?? []).map((button) => (
                    <button
                      key={button.action}
                      type="button"
                      onClick={() => run(order.id, button.action)}
                      className={`rounded-full px-3.5 py-2 text-[12px] font-bold text-white transition ${button.tone}`}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}