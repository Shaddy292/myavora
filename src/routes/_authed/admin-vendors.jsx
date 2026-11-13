import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { getConsoleContext, reviewStore } from "@/lib/avora-fns";
import { adminUpdateVendor, adminVendorBoard } from "@/lib/partner-admin-fns";
import { ADMIN_NAV } from "@/lib/console-nav";
import { formatNGN } from "@/lib/avora";
import { BadgeCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-vendors")({
  loader: async () => {
    const context = await getConsoleContext();
    if (context.role !== "admin") return { context, stores: [] };
    const { stores } = await adminVendorBoard();
    return { context, stores };
  },
  head: () => ({ meta: [{ title: "Vendor management · AVORA admin" }] }),
  component: AdminVendors,
});

const FILTERS = [
  { key: "pending", label: "Awaiting approval" },
  { key: "active", label: "Active stores" },
  { key: "all", label: "All vendors" },
];

function AdminVendors() {
  const { context, stores } = Route.useLoaderData();
  const router = useRouter();
  const update = useServerFn(adminUpdateVendor);
  const decide = useServerFn(reviewStore);
  const [filter, setFilter] = useState("pending");
  const [rates, setRates] = useState({});
  const [busyId, setBusyId] = useState("");

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="vendors" badge="Operations" title="Vendor management" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const pending = stores.filter((store) => !store.is_approved);
  const active = stores.filter((store) => store.is_approved);
  const visible = filter === "pending" ? pending : filter === "active" ? active : stores;

  const run = async (id, action, success) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this vendor");
    } finally {
      setBusyId("");
    }
  };

  const saveRate = (store) => {
    const percent = Number(rates[store.id] ?? Math.round((store.commission_rate ?? 0.1) * 100));
    return run(
      store.id,
      () => update({ data: { store_id: store.id, commission_rate: percent / 100 } }),
      `${store.name} commission set to ${percent}%`
    );
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="vendors"
      badge="Operations"
      title="Vendor management"
      subtitle={`${pending.length} awaiting approval · ${active.length} active stores`}
      role={context.role}
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
              filter === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#8B7A9C] ring-1 ring-[#EFE7F6] hover:text-[#1B1024]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filter === "pending" ? "Nothing waiting" : "No stores here"}
              description={
                filter === "pending"
                  ? "New store applications land here for approval."
                  : "Stores appear here once they have been approved."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {visible.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {store.category} · {store.area || "Nigeria"} · {store.owner_email}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        store.is_approved ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
                      }`}
                    >
                      {store.is_approved ? "Approved" : "Pending review"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        store.is_open ? "bg-[#EEF6FF] text-[#1F5C9B]" : "bg-[#F4F0FB] text-[#5B4A70]"
                      }`}
                    >
                      {store.is_open ? "Open now" : "Closed"}
                    </span>
                    {store.min_order > 0 && (
                      <span className="rounded-full bg-[#FBF8F3] px-2 py-0.5 text-[#8B7A9C]">
                        Min {formatNGN(store.min_order)}
                      </span>
                    )}
                  </p>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8B7A9C]">
                  Commission
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={rates[store.id] ?? Math.round((store.commission_rate ?? 0.1) * 100)}
                    onChange={(event) => setRates((current) => ({ ...current, [store.id]: event.target.value }))}
                    className="w-16 rounded-lg border border-[#E4D9EE] bg-[#FBF8F3] px-2 py-1.5 text-[12px] font-bold text-[#1B1024] outline-none focus:border-[#4B2080]"
                  />
                  %
                </label>

                <button
                  type="button"
                  onClick={() => saveRate(store)}
                  disabled={busyId === store.id}
                  className="rounded-full bg-[#F4F0FB] px-3 py-2 text-[11.5px] font-bold text-[#4B2080] disabled:opacity-60"
                >
                  Save override
                </button>

                <button
                  type="button"
                  onClick={() =>
                    run(
                      store.id,
                      () => update({ data: { store_id: store.id, is_open: !store.is_open } }),
                      store.is_open ? `${store.name} closed` : `${store.name} opened`
                    )
                  }
                  disabled={busyId === store.id}
                  className="rounded-full bg-white px-3 py-2 text-[11.5px] font-bold text-[#8B7A9C] ring-1 ring-[#EFE7F6] disabled:opacity-60"
                >
                  {store.is_open ? "Close store" : "Open store"}
                </button>

                {store.is_approved ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(store.id, () => decide({ data: { store_id: store.id, decision: "reject" } }), "Store suspended")
                    }
                    disabled={busyId === store.id}
                    className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[11.5px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      run(store.id, () => decide({ data: { store_id: store.id, decision: "approve" } }), "Vendor approved")
                    }
                    disabled={busyId === store.id}
                    className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-3 py-2 text-[11.5px] font-bold text-white disabled:opacity-60"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" /> Approve
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}