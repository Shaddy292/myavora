import { Link } from "@tanstack/react-router";
import { ChevronRight, Scale } from "lucide-react";
import { formatDateTime, formatNGN } from "@/lib/avora";

/** One refund request waiting on a support decision. */
export default function DisputeRow({ refund }) {
  return (
    <li>
      <Link
        to="/admin-refunds"
        className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[#FBF8F3]"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#1B1024]">
            <Scale className="h-3.5 w-3.5 text-[#FF7A00]" />
            {refund.order_code || "Order"}
          </p>
          <p className="truncate text-[11.5px] text-[#8B7A9C]">
            {refund.customer_email} · {formatDateTime(refund.created_date)}
          </p>
          {refund.reason && <p className="truncate text-[11px] text-[#A797B4]">{refund.reason}</p>}
        </div>
        <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(refund.amount || 0)}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#C9BCD7]" />
      </Link>
    </li>
  );
}
