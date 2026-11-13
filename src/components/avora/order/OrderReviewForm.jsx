import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/lib/account-fns";
import { cn } from "@/lib/utils";

/** Star rating + comment for a delivered order. */
export default function OrderReviewForm({ order, onDone }) {
  const send = useServerFn(submitReview);
  const [rating, setRating] = useState(order?.rating || 0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(order?.rating));

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) {
      toast.error("Pick a rating first");
      return;
    }
    setBusy(true);
    try {
      await send({
        data: {
          store_id: order.store_id,
          order_code: order.code,
          rating,
          comment: comment.trim() || undefined
        }
      });
      setDone(true);
      toast.success("Thanks for the review");
      await onDone?.();
    } catch (error) {
      toast.error(error?.message || "Could not submit the review");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Your rating</h2>
        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <Star
              key={value}
              className={cn(
                "h-5 w-5",
                value <= (order.rating || rating) ? "fill-[#FFB020] text-[#FFB020]" : "text-[#E4D9EE]"
              )}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[12px] text-[#8B7A9C]">Thanks for letting {order.store_name} know.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Rate this order</h2>
      <p className="text-[11.5px] text-[#9A8CA8]">How was the food and the delivery?</p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "h-6 w-6 transition",
                  value <= rating ? "fill-[#FFB020] text-[#FFB020]" : "text-[#E4D9EE] hover:text-[#FFD9A0]"
                )}
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Tell others what stood out (optional)"
          className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
        />
        <button
          type="submit"
          disabled={busy || !rating}
          className="w-full rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
        >
          {busy ? "Sending…" : "Submit review"}
        </button>
      </form>
    </section>
  );
}
