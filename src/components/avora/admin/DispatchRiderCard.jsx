import { cn } from "@/lib/utils";
import { Bike, Car, MapPin, Truck } from "lucide-react";

const VEHICLE_ICON = { bike: Bike, bicycle: Bike, car: Car, van: Truck };

const STATUS_STYLE = {
  approved: "bg-[#EAF6EF] text-[#1F7A4C]",
  pending: "bg-[#FFF1E4] text-[#B05C00]",
  rejected: "bg-[#FDECEC] text-[#A11D1D]",
  suspended: "bg-[#F2EEF7] text-[#5B4A6B]",
};

/** One rider's live availability for the dispatch desk. */
export default function DispatchRiderCard({ rider, shift, activeCount }) {
  const VehicleIcon = VEHICLE_ICON[rider.vehicle_type] ?? Bike;

  return (
    <li className="rounded-2xl bg-white p-3.5 ring-1 ring-[#EFE7F6]">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            rider.is_online ? "bg-[#1F7A4C]" : "bg-[#D9D0E3]"
          )}
          aria-label={rider.is_online ? "Online" : "Offline"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#1B1024]">{rider.full_name}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-[#8B7A9C]">
            <VehicleIcon className="h-3 w-3" /> {rider.vehicle_type} · {rider.zone || "No zone"}
          </p>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLE[rider.status] ?? STATUS_STYLE.pending)}>
          {rider.status}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#5B4A6B]">
        <span className="font-semibold">
          {shift ? `${shift.start_time}–${shift.end_time}` : "No shift today"}
        </span>
        {shift?.status && shift.status !== "planned" && (
          <span className="capitalize text-[#9A8CA8]">· {shift.status}</span>
        )}
        {rider.phone && <span className="text-[#9A8CA8]">{rider.phone}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-[#FBF8F3] px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#8B7A9C]">
          <MapPin className="h-3 w-3" /> {activeCount} active
        </span>
        <span className="text-[11px] font-bold text-[#2B0B4D]">{rider.deliveries_count ?? 0} done</span>
      </div>
    </li>
  );
}