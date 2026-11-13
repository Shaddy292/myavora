import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import EmptyState from "@/components/avora/EmptyState";
import StatusPill from "@/components/avora/StatusPill";
import { RIDER_NAV } from "@/lib/console-nav";
import { advanceOrder, getConsoleContext } from "@/lib/avora-fns";
import { riderAssignments } from "@/lib/order-fns";
import { coordsFor, nudge, RIDER_PROGRESS } from "@/lib/geo";
import { formatNGN } from "@/lib/avora";
import { MapPin, PackageCheck, Phone, Store } from "lucide-react";

const RiderRouteMap = lazy(() => import("@/components/avora/RiderRouteMap"));

export const Route = createFileRoute("/_authed/rider-tracking")({
  validateSearch: (search) => ({ id: search.id || undefined }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    const [context, data] = await Promise.all([getConsoleContext(), riderAssignments()]);
    const active = data.active ?? [];
    const order = (deps.id ? active.find((row) => row.id === deps.id) : null) ?? active[0] ?? null;
    return { context, order };
  },
  head: () => ({ meta: [{ title: "Route · AVORA rider" }] }),
  component: RiderRoute,
});

function RiderRoute() {
  const { context, order } = Route.useLoaderData();
  const router = useRouter();
  const advance = useServerFn(advanceOrder);
  const [busy, setBusy] = useState(false);

  if (!order) {
    return (
      <ConsoleShell
        nav={RIDER_NAV}
        active="tracking"
        badge="Rider console"
        title="Route"
        subtitle="Pickup to drop-off"
        role={context.role}
      >
        <EmptyState
          title="No active delivery to map"
          description="Accept a job from the deliveries board and its pickup-to-door route appears here."
          action={
            <Link to="/rider" className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white">
              Open deliveries
            </Link>
          }
        />
      </ConsoleShell>
    );
  }

  const storePoint = nudge(coordsFor(order.store_name), order.store_id || order.code);
  const customerPoint = nudge(coordsFor(order.address_area), order.address_area || order.code);

  const move = async (action, message) => {
    setBusy(true);
    try {
      await advance({ data: { order_id: order.id, action, note: message } });
      toast.success(message);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this delivery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="tracking"
      badge="Rider console"
      title="Route"
      subtitle={`${order.code} · ${order.store_name}`}
      role={context.role}
      actions={<StatusPill status={order.status} />}
    >
      <Suspense fallback={<div className="h-[300px] animate-pulse rounded-2xl bg-[#F2EEF7] md:h-[360px]" />}>
        <RiderRouteMap
          storePoint={storePoint}
          customerPoint={customerPoint}
          riderRatio={RIDER_PROGRESS[order.status] ?? 0}
          storeName={order.store_name}
          customerLabel={order.address_label || "Drop-off"}
        />
      </Suspense>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A797B4]">
            <Store className="h-3 w-3" /> Pickup
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#1B1024]">{order.store_name}</p>
          <p className="text-[11.5px] text-[#8B7A9C]">{order.address_area || "Store address on the order"}</p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A797B4]">
            <MapPin className="h-3 w-3" /> Drop-off
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#1B1024]">{order.address_line}</p>
          <p className="text-[11.5px] text-[#8B7A9C]">
            {order.address_area || "—"} · {order.address_label || "Customer"}
          </p>
          {order.address_phone && (
            <a
              href={`tel:${order.address_phone}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#F4EEFA] px-3 py-1.5 text-[11.5px] font-bold text-[#3B0A66]"
            >
              <Phone className="h-3 w-3" /> Call customer
            </a>
          )}
        </section>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <p className="text-[12.5px] text-[#5B4A6B]">
          {(order.items ?? []).length} items · {order.payment_method === "cash" ? "Collect cash" : "Paid online"} ·{" "}
          {formatNGN(order.total)}
          <span className="ml-2 font-bold text-[#2B0B4D]">Your payout {formatNGN(order.rider_payout || 0)}</span>
        </p>
        <div className="flex gap-2">
          {order.status === "rider_assigned" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => move("pickup", "Marked as picked up")}
              className="flex items-center gap-1 rounded-full bg-[#2B0B4D] px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              <PackageCheck className="h-3.5 w-3.5" /> Picked up
            </button>
          )}
          {order.status === "picked_up" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => move("deliver", "Delivery completed")}
              className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              <PackageCheck className="h-3.5 w-3.5" /> Delivered
            </button>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}