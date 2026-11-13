import { cn } from "@/lib/utils";

const TONES = {
  purple: "bg-[#F3ECFB] text-[#4B2080]",
  green: "bg-[#E7F6EC] text-[#15693F]",
  orange: "bg-[#FFF1E4] text-[#B05C00]",
  red: "bg-[#FDECEC] text-[#A11D1D]",
  blue: "bg-[#E9EFFB] text-[#1E4A9E]",
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "purple" }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A8CA8]">{label}</p>
        {Icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", TONES[tone])}>
            <Icon className="h-4 w-4" strokeWidth={2.2} />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#1B1024]">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-[#9A8CA8]">{hint}</p>}
    </div>
  );
}