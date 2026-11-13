import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Flag, FlagOff, Star } from "lucide-react";

/** One customer review with the admin moderation controls. */
export default function AdminReviewItem({ review, onModerate }) {
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-[#1B1024]">
            {review.store_name || "Store"}
            {review.product_name ? <span className="text-[#8B7A9C]"> · {review.product_name}</span> : null}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-[#8B7A9C]">
            {review.customer_name || review.customer_email} · {formatDateTime(review.created_date)}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-bold text-[#B05C00]">
          <Star className="h-3 w-3 fill-[#FFB020] text-[#FFB020]" /> {review.rating ?? "—"}
        </span>
        {review.is_hidden && (
          <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#A11D1D]">
            Hidden
          </span>
        )}
        {review.is_flagged && (
          <span className="rounded-full bg-[#FDF0E4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B05C00]">
            Flagged
          </span>
        )}
      </div>

      <p className="mt-2 rounded-xl bg-[#FBF8F3] px-3 py-2 text-[12.5px] leading-relaxed text-[#5B4A6B]">
        {review.comment || "No comment left."}
      </p>
      {review.flag_reason && (
        <p className="mt-1.5 text-[11px] text-[#B05C00]">Flag reason: {review.flag_reason}</p>
      )}
      {review.vendor_reply && (
        <p className="mt-1.5 text-[11.5px] text-[#4B2080]">Vendor reply: {review.vendor_reply}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onModerate?.(review, review.is_hidden ? "unhide" : "hide")}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition",
            review.is_hidden
              ? "bg-[#EAF6EF] text-[#1F7A4C] hover:bg-[#DDEFE4]"
              : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
          )}
        >
          {review.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {review.is_hidden ? "Restore" : "Hide"}
        </button>
        {review.is_flagged && (
          <button
            type="button"
            onClick={() => onModerate?.(review, "clear_flag")}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6] transition hover:text-[#2B0B4D]"
          >
            <FlagOff className="h-3.5 w-3.5" /> Clear flag
          </button>
        )}
        {!review.is_flagged && !review.is_hidden && (
          <span className="flex items-center gap-1.5 px-1 text-[11px] text-[#A797B4]">
            <Flag className="h-3 w-3" /> Visible to customers
          </span>
        )}
      </div>
    </li>
  );
}
