import { Image } from "@/components/ui/image";
import { Plus } from "lucide-react";

export default function ProductTile({ item }) {
  return (
    <div className="w-[148px] shrink-0 rounded-2xl bg-white p-3 ring-1 ring-[#F1E9F7] transition hover:ring-[#D9C6EA]">
      <div className={`flex h-[92px] items-center justify-center overflow-hidden rounded-xl text-[38px] ${item.tint || "bg-[#F6EEFB]"}`}>
        {item.image_url ? (
          <Image src={item.image_url} alt={item.name} className="h-full w-full" fittingType="fill" />
        ) : (
          <span aria-hidden="true">{item.emoji}</span>
        )}
      </div>
      <p className="mt-2.5 truncate text-[13px] font-semibold text-[#1B1024]">{item.name}</p>
      <p className="text-[11px] text-[#9A8CA8]">{item.unit}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[13px] font-bold text-[#2B0B4D]">{item.price}</span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF1E4] text-[#FF7A00]">
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}