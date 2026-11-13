import { ORDER_STATUS } from "@/lib/avora";
import { cn } from "@/lib/utils";

export default function StatusPill({ status, className = "" }) {
  const meta = ORDER_STATUS[status] ?? { label: status, tone: "bg-[#F2EEF7] text-[#5B4A6B] ring-[#E4D9EE]" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
        meta.tone,
        className
      )}
    >
      {meta.label}
    </span>
  );
}