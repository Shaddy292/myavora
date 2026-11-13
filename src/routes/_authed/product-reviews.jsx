import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import VendorReviewItem from "@/components/avora/reviews/VendorReviewItem";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { flagReview, replyToReview, reviewBoard } from "@/lib/platform-fns";
import { cn } from "@/lib/utils";
import { Flag, MessageSquare, Star, Store } from "lucide-react";

export const Route = createFileRoute("/_authed/product-reviews")({
  loader: async () => {
    const context = await getConsoleContext();
    const board = await reviewBoard();
    return { context, board };
  },
  head: () => ({ meta: [{ title: "Product reviews · AVORA vendor" }] }),
  component: ProductReviews,
});

const FILTERS = [
  { key: "all", label: "All reviews" },
  { key: "unreplied", label: "Needs a reply" },
  { key: "flagged", label: "Flagged" },
];

function ProductReviews() {
  const { context, board } = Route.useLoaderData();
  const router = useRouter();
  const reply = useServerFn(replyToReview);
  const flag = useServerFn(flagReview);
  const [filter, setFilter] = useState("all");
  const [product, setProduct] = useState("all");

  const reviews = board.reviews;
  const products = useMemo(() => {
    const map = new Map();
    reviews.forEach((row) => {
      if (row.product_id && !map.has(row.product_id)) map.set(row.product_id, row.product_name || "Product");
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [reviews]);

  const productOptions = useMemo(
    () => [
      { value: "all", label: "All products" },
      ...products.map((row) => ({ value: row.id, label: row.name })),
    ],
    [products]
  );

  const visible = useMemo(
    () =>
      reviews.filter((row) => {
        const matchesFilter =
          filter === "all" || (filter === "unreplied" ? !row.vendor_reply : row.is_flagged);
        const matchesProduct = product === "all" || row.product_id === product;
        return matchesFilter && matchesProduct;
      }),
    [reviews, filter, product]
  );

  const average = reviews.length
    ? reviews.reduce((sum, row) => sum + (row.rating || 0), 0) / reviews.length
    : 0;

  if (!context.store && !board.admin) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="reviews" badge="Vendor console" title="Product reviews" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const sendReply = async (review, text) => {
    if (text.length < 2) {
      toast.error("Write a short reply first");
      return;
    }
    try {
      await reply({ data: { id: review.id, reply: text } });
      toast.success("Reply published");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save the reply");
    }
  };

  const sendFlag = async (review, flagged, reason) => {
    try {
      await flag({ data: { id: review.id, flagged, reason } });
      toast.success(flagged ? "Review sent for moderation" : "Flag removed");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this review");
    }
  };

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="reviews"
      badge={board.admin ? "Administrator" : "Vendor console"}
      title="Product reviews"
      subtitle={`${reviews.length} reviews · ${reviews.filter((row) => !row.vendor_reply).length} waiting on a reply`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Average rating" value={average ? average.toFixed(1) : "—"} hint="Across all products" icon={Star} tone="orange" />
        <StatCard label="Reviews" value={reviews.length} hint="All time" icon={MessageSquare} tone="purple" />
        <StatCard label="Needs a reply" value={reviews.filter((row) => !row.vendor_reply).length} hint="Customers waiting" icon={Store} tone="blue" />
        <StatCard label="Flagged" value={reviews.filter((row) => row.is_flagged).length} hint="Sent to moderation" icon={Flag} tone="red" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              filter === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
        {products.length > 0 && (
          <FieldSelect
            value={product}
            onChange={setProduct}
            options={productOptions}
            placeholder="All products"
            ariaLabel="Filter by product"
            className="ml-auto mt-0 h-9 w-[180px] rounded-full"
          />
        )}
      </div>

      <section className="mt-3 space-y-2">
        {visible.length === 0 ? (
          <EmptyState
            title="No reviews here yet"
            description="Customer ratings for your products land in this queue so you can reply or flag them."
          />
        ) : (
          visible.map((review) => (
            <VendorReviewItem key={review.id} review={review} onReply={sendReply} onFlag={sendFlag} />
          ))
        )}
      </section>
    </ConsoleShell>
  );
}