import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { MapPin, Plus, Trash2 } from "lucide-react";

const DeliveryZoneMap = lazy(() => import("@/components/avora/console/DeliveryZoneMap"));

export const Route = createFileRoute("/_authed/delivery-zones")({
  loader: async () => {
    const context = await getConsoleContext();
    const zones = await db.entities.DeliveryZone.list("-created_date", 100);
    return { context, zones };
  },
  head: () => ({ meta: [{ title: "Delivery areas · AVORA admin" }] }),
  component: DeliveryZones,
});

const BLANK = {
  id: "",
  name: "",
  area: "",
  radius_km: "3",
  delivery_fee: "500",
  notes: "",
  lat: 6.5095,
  lng: 3.3711,
};

function DeliveryZones() {
  const { context, zones } = Route.useLoaderData();
  const router = useRouter();
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="zones" badge="Operations" title="Delivery areas" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const record = {
        name: draft.name.trim(),
        area: draft.area.trim(),
        center_lat: Number(draft.lat),
        center_lng: Number(draft.lng),
        radius_km: Number(draft.radius_km) || 1,
        delivery_fee: Number(draft.delivery_fee) || 0,
        notes: draft.notes.trim(),
      };
      if (draft.id) await db.entities.DeliveryZone.update(draft.id, record);
      else await db.entities.DeliveryZone.create({ ...record, is_active: true });
      toast.success(draft.id ? "Zone updated" : `${record.name} zone created`);
      setDraft({ ...BLANK, lat: record.center_lat, lng: record.center_lng });
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save this zone");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (zone) => {
    try {
      await db.entities.DeliveryZone.update(zone.id, { is_active: zone.is_active === false });
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this zone");
    }
  };

  const remove = async (zone) => {
    try {
      await db.entities.DeliveryZone.delete(zone.id);
      toast.success(`${zone.name} removed`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not remove this zone");
    }
  };

  const edit = (zone) =>
    setDraft({
      id: zone.id,
      name: zone.name ?? "",
      area: zone.area ?? "",
      radius_km: String(zone.radius_km ?? 3),
      delivery_fee: String(zone.delivery_fee ?? 0),
      notes: zone.notes ?? "",
      lat: zone.center_lat ?? BLANK.lat,
      lng: zone.center_lng ?? BLANK.lng,
    });

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="zones"
      badge="Operations"
      title="Delivery areas"
      subtitle={`${zones.length} geofenced zones · ${zones.filter((zone) => zone.is_active !== false).length} active`}
      role={context.role}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1.05fr]">
        <form onSubmit={save} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
            <MapPin className="h-4 w-4 text-[#4B2080]" /> {draft.id ? "Edit zone" : "Define a zone"}
          </h2>
          <p className="mt-1 text-[11.5px] text-[#8B7A9C]">
            Tap the map to drop the centre, then set how far riders cover around it.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Zone name (Yaba core)"
              className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
            />
            <input
              value={draft.area}
              onChange={(event) => setDraft({ ...draft, area: event.target.value })}
              placeholder="Area (Yaba)"
              className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
            />
            <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[#5B4A6B]">
              Radius
              <input
                type="number"
                min="1"
                max="40"
                value={draft.radius_km}
                onChange={(event) => setDraft({ ...draft, radius_km: event.target.value })}
                className="w-[80px] rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
              km
            </label>
            <input
              type="number"
              min="0"
              value={draft.delivery_fee}
              onChange={(event) => setDraft({ ...draft, delivery_fee: event.target.value })}
              placeholder="Delivery fee (₦)"
              className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
            />
            <input
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="Coverage notes (optional)"
              className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080] sm:col-span-2"
            />
          </div>
          <p className="mt-2 text-[11px] text-[#A797B4]">
            Centre {Number(draft.lat).toFixed(4)}, {Number(draft.lng).toFixed(4)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> {busy ? "Saving…" : draft.id ? "Save zone" : "Create zone"}
            </button>
            {draft.id && (
              <button
                type="button"
                onClick={() => setDraft(BLANK)}
                className="text-[12px] font-bold text-[#8B7A9C] hover:text-[#2B0B4D]"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <div>
          <Suspense
            fallback={<div className="h-[320px] animate-pulse rounded-2xl bg-white ring-1 ring-[#EFE7F6]" />}
          >
            <DeliveryZoneMap
              center={[Number(draft.lat), Number(draft.lng)]}
              radiusKm={Number(draft.radius_km) || 1}
              zones={zones}
              onPick={([lat, lng]) => setDraft((current) => ({ ...current, lat, lng }))}
            />
          </Suspense>
          <p className="mt-2 text-[11px] text-[#9A8CA8]">Green rings are saved zones · orange ring is the zone you're editing.</p>
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {zones.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No delivery areas yet" description="Define your first zone above to set where stores and riders operate." />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {zones.map((zone) => (
              <li key={zone.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#1B1024]">{zone.name}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {zone.area || "Unnamed area"} · {zone.radius_km ?? 1} km radius · fee {formatNGN(zone.delivery_fee ?? zone.fee ?? 0)}
                    {zone.notes ? ` · ${zone.notes}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(zone)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                    zone.is_active !== false ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FDECEC] text-[#A11D1D]"
                  )}
                >
                  {zone.is_active !== false ? "Active" : "Paused"}
                </button>
                <button
                  type="button"
                  onClick={() => edit(zone)}
                  className="rounded-full bg-[#F4EEFA] px-2.5 py-1 text-[11px] font-bold text-[#3B0A66]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(zone)}
                  className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Remove ${zone.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}