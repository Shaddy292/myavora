import { useState } from "react";
import { Flag, MessageSquare, Star } from "lucide-react";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";

/** One product review in the vendor queue, with reply and flag actions. */
export default function VendorReviewItem({ review, onReply, onFlag }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");

  const sendReply = () => {
    onReply?.(review, reply.trim());
    setReply("");
    setReplying(false);
  };

  const sendFlag = () => {
    onFlag?.(review, !review.is_flagged, reason.trim());
    setReason("");
    setFlagging(false);
  };

  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-[#1B1024]">{review.product_name || "Product"}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-[#8B7A9C]">
            {review.customer_name || review.customer_email} · {formatDateTime(review.created_date)}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-bold text-[#B05C00]">
          <Star className="h-3 w-3 fill-[#FFB020] text-[#FFB020]" /> {review.rating ?? "—"}
        </span>
        {review.is_flagged && (
          <span className="rounded-full bg-[#FDF0E4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#B05C00]">
            Flagged
          </span>
        )}
      </div>

      <p className="mt-2 rounded-xl bg-[#FBF8F3] px-3 py-2 text-[12.5px] leading-relaxed text-[#5B4A6B]">
        {review.comment || "No comment left."}
      </p>

      {review.vendor_reply ? (
        <p className="mt-1.5 rounded-xl bg-[#F3ECFB] px-3 py-2 text-[12px] text-[#4B2080]">
          <span className="font-bold">Your reply:</span> {review.vendor_reply}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] font-semibold text-[#B05C00]">Waiting on your reply</p>
      )}

      {replying && (
        <div className="mt-2 space-y-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Reply to this customer"
            className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12px] outline-none focus:border-[#4B2080]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendReply}
              className="rounded-xl bg-[#2B0B4D] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#3B0A66]"
            >
              Publish reply
            </button>
            <button
              type="button"
              onClick={() => setReplying(false)}
              className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {flagging && !review.is_flagged && (
        <div className="mt-2 space-y-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            placeholder="Why should this review be reviewed?"
            className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12px] outline-none focus:border-[#4B2080]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendFlag}
              className="rounded-xl bg-[#B05C00] px-3 py-2 text-[12px] font-bold text-white transition hover:bg-[#9A4F00]"
            >
              Send for moderation
            </button>
            <button
              type="button"
              onClick={() => setFlagging(false)}
              className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setReplying((value) => !value)}
          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#4B2080] ring-1 ring-[#EDE5F4] transition hover:bg-[#F8F5FC]"
        >
          <MessageSquare className="h-3.5 w-3.5" /> {review.vendor_reply ? "Edit reply" : "Reply"}
        </button>
        <button
          type="button"
          onClick={() => (review.is_flagged ? onFlag?.(review, false, "") : setFlagging((value) => !value))}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold transition",
            review.is_flagged
              ? "bg-[#EAF6EF] text-[#1F7A4C] hover:bg-[#DDEFE4]"
              : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
          )}
        >
          <Flag className="h-3.5 w-3.5" /> {review.is_flagged ? "Remove flag" : "Flag"}
        </button>
      </div>
    </li>
  );
}
