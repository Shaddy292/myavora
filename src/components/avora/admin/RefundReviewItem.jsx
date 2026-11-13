import { useState } from "react";
import { formatDateTime, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { CheckCircle2, RotateCcw, Wallet, XCircle } from "lucide-react";

const STATUS_STYLE = {
  requested: "bg-[#FFF1E4] text-[#B05C00]",
  approved: "bg-[#EAF6EF] text-[#1F7A4C]",
  processed: "bg-[#EEF1FF] text-[#2B4B9B]",
  rejected: "bg-[#FDECEC] text-[#A11D1D]",
};

/** One refund request with the admin decision controls. */
export default function RefundReviewItem({ refund, busy, onDecide }) {
  const [note, setNote] = useState(refund.note ?? "");
  const pending = refund.status === "requested";

  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-[#1B1024]">
            <RotateCcw className="h-3.5 w-3.5 text-[#4B2080]" /> {refund.order_code || "Order"}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-[#8B7A9C]">
            {refund.customer_email} · requested {formatDateTime(refund.created_date)}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold capitalize", STATUS_STYLE[refund.status])}>
          {refund.status}
        </span>
        <span className="text-[15px] font-bold text-[#2B0B4D]">{formatNGN(refund.amount)}</span>
      </div>

      <p className="mt-2 rounded-xl bg-[#FBF8F3] px-3 py-2 text-[12.5px] leading-relaxed text-[#5B4A6B]">
        {refund.reason || "No reason given"}
      </p>

      {refund.decided_by && (
        <p className="mt-1.5 text-[11px] text-[#9A8CA8]">Handled by {refund.decided_by}</p>
      )}

      {(pending || refund.status === "approved") && (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Decision note (optional)"
            className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12px] outline-none focus:border-[#4B2080]"
          />
          <div className="flex flex-wrap gap-2">
            {pending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(refund, "approved", note)}
                className="flex items-center gap-1.5 rounded-xl bg-[#1F7A4C] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#1A6A42] disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </button>
            )}
            {refund.status === "approved" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(refund, "processed", note)}
                className="flex items-center gap-1.5 rounded-xl bg-[#2B0B4D] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
              >
                <Wallet className="h-3.5 w-3.5" /> Mark refunded
              </button>
            )}
            {pending && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide(refund, "rejected", note)}
                className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] transition hover:bg-[#FDECEC] disabled:opacity-60"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}