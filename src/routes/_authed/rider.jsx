import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import RiderApply from "@/components/avora/console/RiderApply";
import StatCard from "@/components/avora/StatCard";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import { advanceOrder, availableJobs, claimDelivery, getConsoleContext, setRiderOnline } from "@/lib/avora-fns";
import { RIDER_NAV } from "@/lib/console-nav";
import { formatNGN, formatDateTime } from "@/lib/avora";
import { Bike, Wallet, PackageCheck, WifiOff, MapPin, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authed/rider")({
  loader: async () => {
    const context = await getConsoleContext();
    if (context.rider?.status !== "approved") return { context, jobs: [], active: [], history: [] };
    const [jobs, mine] = await Promise.all([
      availableJobs(),
      db.entities.Order.filter({ rider_email: context.user.email }, { sort: "-created_date", limit: 50 }),
    ]);
    const orders = mine.items ?? mine;
    return {
      context,
      jobs,
      active: orders.filter((o) => ["rider_assigned", "picked_up"].includes(o.status)),
      history: orders.filter((o) => o.status === "delivered"),
    };
  },
  head: () => ({ meta: [{ title: "Rider console · AVORA" }] }),
  component: RiderConsole,
});

function RiderConsole() {
  const { context, jobs, active, history } = Route.useLoaderData();
  const router = useRouter();
  const advance = useServerFn(advanceOrder);
  const claim = useServerFn(claimDelivery);
  const toggleOnline = useServerFn(setRiderOnline);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const rider = context.rider;

  if (!rider) {
    return (
      <ConsoleShell nav={RIDER_NAV} active="deliveries" badge="Rider console" title="Become a rider" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 rounded-2xl bg-[#FFF6EA] p-4 text-[12.5px] text-[#8A5200] ring-1 ring-[#FBE3C4]">
            Riders must pass identity and vehicle verification before receiving deliveries.
          </div>
          <RiderApply />
        </div>
      </ConsoleShell>
    );
  }

  if (rider.status !== "approved") {
    return (
      <ConsoleShell
        nav={RIDER_NAV}
        active="deliveries"
        badge="Rider console"
        title="Verification in progress"
        subtitle={rider.full_name}
        role={context.role}
      >
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center ring-1 ring-[#EFE7F6]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#B05C00]">
            <PackageCheck className="h-6 w-6" />
          </span>
          <h2 className="font-display mt-3 text-[18px] font-bold text-[#1B1024]">
            {rider.status === "suspended" ? "Account suspended" : "Documents under review"}
          </h2>
          <p className="mt-1 text-[13px] text-[#8B7A9C]">
            We're checking your {rider.id_type || "ID"} and vehicle details. You'll be able to go online once approved.
          </p>
          {rider.review_note && (
            <p className="mt-2 rounded-xl bg-[#FBF8F3] px-3 py-2 text-[12px] text-[#5B4A6B]">
              Operations note: {rider.review_note}
            </p>
          )}
        </div>
      </ConsoleShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const deliveredToday = history.filter((o) => (o.delivered_at || "").slice(0, 10) === today);
  const earnedToday = deliveredToday.reduce((s, o) => s + (o.rider_payout || 0), 0);

  const act = async (orderId, action) => {
    setBusy(true);
    try {
      await advance({ data: { order_id: orderId, action } });
      toast.success("Delivery updated");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this delivery");
    } finally {
      setBusy(false);
    }
  };

  const reportProblem = async (orderId) => {
    const note = window.prompt("What went wrong with this delivery?");
    if (!note) return;
    await act(orderId, "fail");
  };

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="deliveries"
      badge="Rider console"
      title={`Hi ${rider.full_name?.split(" ")[0] || "rider"}`}
      subtitle={`${rider.vehicle_type} · ${rider.zone || "Nigeria"} · ${jobs.length} jobs nearby`}
      role={context.role}
      actions={
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            try {
              await toggleOnline({ data: { online: !rider.is_online } });
              toast.success(rider.is_online ? "You're offline" : "You're online — jobs incoming");
              await router.invalidate();
            } catch (error) {
              toast.error(error?.message || "Could not change your status");
            }
          }}
          className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-bold text-white transition disabled:opacity-60 ${
            rider.is_online ? "bg-[#1F7A4C] hover:bg-[#1A6A42]" : "bg-[#8B7A9C] hover:bg-[#7A6A8B]"
          }`}
        >
          {rider.is_online ? "Online" : "Go online"}
        </button>
      }
    >
      {offline && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-[#FFF4E3] px-4 py-3 text-[12.5px] font-medium text-[#8A5200] ring-1 ring-[#FBE3C4]">
          <WifiOff className="h-4 w-4" /> You're offline. Updates will sync when the connection returns.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Earned today" value={formatNGN(earnedToday)} icon={Wallet} tone="green" hint={`${deliveredToday.length} completed`} />
        <StatCard label="Active jobs" value={active.length} icon={Bike} tone="purple" hint="Pickup & drop-off" />
        <StatCard label="Cash on hand" value={formatNGN(rider.cash_on_hand || 0)} icon={Wallet} tone="orange" hint="Remit at settlement" />
        <StatCard label="Rating" value={`${(rider.rating ?? 5).toFixed(1)} ★`} icon={PackageCheck} tone="blue" hint={`${rider.deliveries_count || 0} deliveries`} />
      </div>

      {active.length > 0 && (
        <section className="mt-5">
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Active delivery</h2>
          <div className="mt-3 grid gap-3">
            {active.map((order) => (
              <article key={order.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-[15px] font-bold text-[#1B1024]">{order.code}</p>
                    <p className="text-[12px] text-[#8B7A9C]">{order.store_name}</p>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A00]" />
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#1B1024]">
                      {order.address_label || "Drop-off"} · {order.address_area}
                    </p>
                    <p className="text-[11.5px] text-[#8B7A9C]">{order.address_line}</p>
                    <p className="text-[11.5px] text-[#8B7A9C]">{order.address_phone || order.customer_phone}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-[#1B1024]">
                    {formatNGN(order.total)} · {order.payment_method === "cash" ? "Collect cash" : "Paid online"}
                  </p>
                  <div className="flex gap-2">
                    {order.status === "rider_assigned" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(order.id, "pickup")}
                        className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                      >
                        Confirm pickup
                      </button>
                    )}
                    {order.status === "picked_up" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(order.id, "deliver")}
                        className="rounded-full bg-[#1F7A4C] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                      >
                        Confirm delivery
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => reportProblem(order.id)}
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[12px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7]"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Problem
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Available jobs</h2>
        {jobs.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No jobs waiting"
              description={
                rider.is_online
                  ? "Stay online — new pickups appear here the moment a store marks an order ready."
                  : "Go online to start receiving delivery jobs."
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {jobs.map((job) => (
              <article key={job.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-[14.5px] font-bold text-[#1B1024]">{job.store_name}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">
                      {job.code} · ready {formatDateTime(job.created_date)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E7F6EC] px-2.5 py-1 text-[11px] font-bold text-[#15693F]">
                    {formatNGN(Math.round((job.delivery_fee || 400) * 0.9))}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#5B4A6B]">
                  <MapPin className="h-3.5 w-3.5 text-[#FF7A00]" /> {job.address_area || "Nigeria"} ·{" "}
                  {job.address_line}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await claim({ data: { order_id: job.id } });
                      toast.success("Job accepted — head to the store");
                      await router.invalidate();
                    } catch (error) {
                      toast.error(error?.message || "Could not accept this job");
                    }
                  }}
                  className="mt-3 w-full rounded-xl bg-[#FF7A00] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
                >
                  Accept job
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </ConsoleShell>
  );
}