import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import StatusPill from "@/components/avora/StatusPill";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { adminFleetBoard } from "@/lib/insight-fns";
import { timeAgo } from "@/lib/avora";
import { Bike, MapPin, Package, Store } from "lucide-react";

const DeliveryFleetMap = lazy(() => import("@/components/avora/console/DeliveryFleetMap"));

export const Route = createFileRoute("/_authed/delivery-map")({
  loader: async () => {
    const context = await getConsoleContext();
    const canView = context.permissions.includes("orders.view");
    const board = canView ? await adminFleetBoard() : null;
    return { context, canView, board };
  },
  head: () => ({ meta: [{ title: "Delivery map · AVORA admin" }] }),
  component: DeliveryMap,
});

function DeliveryMap() {
  const { context, canView, board } = Route.useLoaderData();

  if (!canView) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="fleet" badge="Operations" title="Delivery map" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const withRider = board.deliveries.filter((row) => row.rider_name).length;

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="fleet"
      badge="Operations"
      title="City delivery map"
      subtitle={`${board.deliveries.length} active orders · ${board.riderPositions.length} riders online`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active deliveries" value={board.deliveries.length} hint="Across Nigeria" icon={Package} tone="purple" />
        <StatCard label="With a rider" value={withRider} hint="Moving right now" icon={Bike} tone="orange" />
        <StatCard label="Riders online" value={board.riderPositions.length} hint="Approved & available" icon={MapPin} tone="green" />
        <StatCard label="At stores" value={board.deliveries.length - withRider} hint="Awaiting pickup" icon={Store} tone="blue" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {board.deliveries.length === 0 ? (
            <EmptyState title="Nothing in motion" description="New orders appear on the map the moment customers place them." />
          ) : (
            <Suspense fallback={<div className="h-[380px] animate-pulse rounded-2xl bg-[#F2EEF7]" />}>
              <DeliveryFleetMap deliveries={board.deliveries} />
            </Suspense>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-[#8B7A9C]">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#1F7A4C]" /> Store pickup</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#2B0B4D]" /> Customer</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#FF7A00]" /> Rider en route</span>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Live deliveries</h2>
          {board.deliveries.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[#8B7A9C]">No active orders.</p>
          ) : (
            <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {board.deliveries.map((row) => (
                <li key={row.id} className="rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-bold text-[#1B1024]">{row.code}</p>
                    <StatusPill status={row.status} />
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[#8B7A9C]">
                    {row.store_name} → {row.address_area || row.address_line}
                  </p>
                  <p className="text-[11px] text-[#A797B4]">
                    {row.rider_name ? row.rider_name : "No rider yet"} · placed {timeAgo(row.created_date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/orders" className="mt-3 block rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-center text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]">
            Open the order desk
          </Link>
        </section>
      </div>
    </ConsoleShell>
  );
}