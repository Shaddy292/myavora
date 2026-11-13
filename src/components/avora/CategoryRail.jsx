import { cn } from "@/lib/utils";

export default function CategoryRail({ items, active, onSelect }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const isActive = active === item.label;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect?.(isActive ? null : item.label)}
            className={cn(
              "group flex w-[86px] shrink-0 flex-col items-center gap-2 rounded-2xl px-2 py-3 transition",
              isActive
                ? "bg-[#2B0B4D] text-white shadow-[0_10px_24px_-14px_rgba(43,11,77,0.9)]"
                : "bg-white text-[#2B0B4D] ring-1 ring-[#F1E9F7] hover:ring-[#D9C6EA]"
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-[20px] transition",
                isActive ? "bg-white/15" : item.tint
              )}
            >
              {item.emoji}
            </span>
            <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}