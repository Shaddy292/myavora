import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import CustomerShell from "@/components/avora/CustomerShell";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import PullToRefresh from "@/components/avora/PullToRefresh";
import { ACTIVE_STATUSES, formatNGN, formatDateTime } from "@/lib/avora";
import { listMyOrders } from "@/lib/order-fns";
import { cartLinesFromOrder, replaceCart } from "@/lib/cart";
import { Bike, Receipt, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/order-history")({
  loader: async () => ({ orders: await listMyOrders() }),
  head: () => ({ meta: [{ title: "Order history · AVORA" }] }),
  component: OrderHistory,
});

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

function OrderHistory() {
  const { orders } = Route.useLoaderData();
  const [tab, setTab] = useState("all");
  const navigate = useNavigate();

  const counts = useMemo(
    () => ({
      all: orders.length,
      active: orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length,
      delivered: orders.filter((order) => order.status === "delivered").length,
      cancelled: orders.filter((order) => ["cancelled", "failed"].includes(order.status)).length,
    }),
    [orders]
  );

  const visible = useMemo(() => {
    if (tab === "active") return orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    if (tab === "delivered") return orders.filter((order) => order.status === "delivered");
    if (tab === "cancelled") return orders.filter((order) => ["cancelled", "failed"].includes(order.status));
    return orders;
  }, [orders, tab]);

  const reorder = (order) => {
    replaceCart(cartLinesFromOrder(order));
    toast.success("Items added to your basket");
    navigate({ to: "/checkout" });
  };

  return (
    <CustomerShell>
      <PullToRefresh />
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Your orders</h1>
      <p className="text-[13px] text-[#8B7A9C]">Every AVORA order, receipt and reorder in one place.</p>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              tab === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label} · {counts[entry.key]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No orders here yet"
            description="Once you place an order it will appear in this list with its receipt."
            action={
              <Link to="/store-menu" className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white">
                Browse stores
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((order) => (
            <li key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-bold text-[#1B1024]">{order.store_name}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {order.code} · {formatDateTime(order.created_date)} · {(order.items ?? []).length} items
                  </p>
                </div>
                <StatusPill status={order.status} />
              </div>

              <p className="mt-2 text-[12.5px] text-[#8B7A9C]">
                {(order.items ?? []).map((item) => `${item.qty}× ${item.name}`).join(", ")}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] font-extrabold text-[#2B0B4D]">{formatNGN(order.total)}</span>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/order-details"
                    search={{ id: order.id }}
                    className="flex items-center gap-1 rounded-full bg-[#F4EEFA] px-3 py-1.5 text-[11.5px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5]"
                  >
                    <Receipt className="h-3.5 w-3.5" /> View details
                  </Link>
                  {ACTIVE_STATUSES.includes(order.status) && (
                    <Link
                      to="/live-tracking"
                      search={{ id: order.id }}
                      className="flex items-center gap-1 rounded-full bg-[#FFF1E4] px-3 py-1.5 text-[11.5px] font-bold text-[#B05C00] transition hover:bg-[#FFE6CC]"
                    >
                      <Bike className="h-3.5 w-3.5" /> Track
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => reorder(order)}
                    className="flex items-center gap-1 rounded-full bg-[#2B0B4D] px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-[#3B0A66]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reorder
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CustomerShell>
  );
}