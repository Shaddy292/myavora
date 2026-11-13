import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { adminVerifications, getConsoleContext, reviewRider, reviewStore } from "@/lib/avora-fns";
import { recordStoreJoinFee } from "@/lib/finance-fns";
import { ADMIN_NAV } from "@/lib/console-nav";
import { formatNGN } from "@/lib/avora";
import { BadgeCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authed/admin_/verification")({
  loader: async () => {
    const context = await getConsoleContext();
    try {
      return { context, data: await adminVerifications(), denied: false };
    } catch (error) {
      if (error?.status === 403) return { context, data: null, denied: true };
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Verification · AVORA admin" }] }),
  component: AdminVerification,
});

function AdminVerification() {
  const { context, data, denied } = Route.useLoaderData();
  const router = useRouter();
  const storeDecision = useServerFn(reviewStore);
  const riderDecision = useServerFn(reviewRider);
  const joinFee = useServerFn(recordStoreJoinFee);

  if (denied) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="verification" badge="Operations" title="Verification" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const decideStore = async (id, decision) => {
    try {
      await storeDecision({ data: { store_id: id, decision } });
      toast.success(`Vendor ${decision === "approve" ? "approved" : "rejected"}`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the vendor");
    }
  };

  const collectFee = async (id) => {
    try {
      await joinFee({ data: { store_id: id } });
      toast.success("Joining fee recorded");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not record the fee");
    }
  };

  const decideRider = async (id, decision) => {
    try {
      await riderDecision({ data: { rider_id: id, decision } });
      toast.success(`Rider ${decision}`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the rider");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="verification"
      badge="Operations"
      title="Verification queue"
      subtitle={`${data.stores.length} vendors · ${data.riders.length} riders awaiting review`}
      role={context.role}
    >
      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Vendor applications</h2>
        {data.stores.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No vendors waiting" description="New store applications land here for approval." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.stores.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {store.category} · {store.area || "Nigeria"} · {store.owner_email}
                  </p>
                  <p className="text-[11.5px] text-[#9A8CA8]">{store.address}</p>
                  <p className="mt-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                        store.feePaid
                          ? "bg-[#E7F6EC] text-[#15693F]"
                          : "bg-[#FDECEC] text-[#A11D1D]"
                      }`}
                    >
                      {store.feePaid
                        ? "Joining fee paid"
                        : `Joining fee unpaid${store.feeDue ? ` · ${formatNGN(store.feeDue)}` : ""}`}
                    </span>
                  </p>
                </div>
                {!store.feePaid && (
                  <button
                    type="button"
                    onClick={() => collectFee(store.id)}
                    className="rounded-full bg-[#FFF4E3] px-3.5 py-2 text-[12px] font-bold text-[#A95400] ring-1 ring-[#FBE3C4]"
                  >
                    Fee received
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => decideStore(store.id, "approve")}
                  className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-3.5 py-2 text-[12px] font-bold text-white"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decideStore(store.id, "reject")}
                  className="flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7]"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Rider identity & vehicle checks</h2>
        {data.riders.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No riders waiting" description="Rider applications appear here with their ID and vehicle details." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#F3ECF9]">
            {data.riders.map((rider) => (
              <li key={rider.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#1B1024]">{rider.full_name}</p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {rider.vehicle_type} {rider.plate_number ? `· ${rider.plate_number}` : ""} ·{" "}
                    {rider.id_type || "ID"} {rider.id_number ? `· ${rider.id_number}` : ""}
                  </p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {rider.phone} · {rider.user_email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => decideRider(rider.id, "approve")}
                  className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-3.5 py-2 text-[12px] font-bold text-white"
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => decideRider(rider.id, "reject")}
                  className="flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7]"
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Approved partners</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.approvedStores.map((store) => (
            <span key={store.id} className="rounded-full bg-[#E7F6EC] px-3 py-1 text-[11.5px] font-semibold text-[#15693F]">
              {store.name}
            </span>
          ))}
          {data.reviewedRiders.map((rider) => (
            <span
              key={rider.id}
              className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${
                rider.status === "approved"
                  ? "bg-[#E7F6EC] text-[#15693F]"
                  : "bg-[#FDECEC] text-[#A11D1D]"
              }`}
            >
              {rider.full_name} · {rider.status}
            </span>
          ))}
          {data.approvedStores.length === 0 && data.reviewedRiders.length === 0 && (
            <p className="text-[12.5px] text-[#9A8CA8]">No partners verified yet.</p>
          )}
        </div>
      </section>
    </ConsoleShell>
  );
}