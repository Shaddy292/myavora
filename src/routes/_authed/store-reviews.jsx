import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import AdminReviewItem from "@/components/avora/reviews/AdminReviewItem";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { moderateReview, reviewBoard } from "@/lib/platform-fns";
import { cn } from "@/lib/utils";
import { EyeOff, Flag, Star, Store } from "lucide-react";

export const Route = createFileRoute("/_authed/store-reviews")({
  loader: async () => {
    const context = await getConsoleContext();
    const board = await reviewBoard();
    return { context, board };
  },
  head: () => ({ meta: [{ title: "Store reviews · AVORA admin" }] }),
  component: StoreReviews,
});

const FILTERS = [
  { key: "all", label: "All reviews" },
  { key: "flagged", label: "Flagged" },
  { key: "hidden", label: "Hidden" },
];

function StoreReviews() {
  const { context, board } = Route.useLoaderData();
  const router = useRouter();
  const moderate = useServerFn(moderateReview);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const reviews = board.reviews;
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return reviews.filter((row) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "flagged" ? row.is_flagged : row.is_hidden);
      const matchesQuery =
        !term ||
        `${row.store_name ?? ""} ${row.product_name ?? ""} ${row.customer_name ?? ""} ${row.customer_email ?? ""} ${
          row.comment ?? ""
        }`
          .toLowerCase()
          .includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [reviews, filter, query]);

  if (!board.admin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="reviews" badge="Operations" title="Store reviews" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const average = reviews.length
    ? reviews.reduce((sum, row) => sum + (row.rating || 0), 0) / reviews.length
    : 0;

  const act = async (review, action) => {
    try {
      await moderate({ data: { id: review.id, action } });
      toast.success(
        action === "hide" ? "Review hidden from customers" : action === "unhide" ? "Review restored" : "Flag cleared"
      );
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this review");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="reviews"
      badge="Operations"
      title="Store reviews"
      subtitle="Moderate every rating customers leave for stores and products"
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Average rating" value={average ? average.toFixed(1) : "—"} hint="Platform-wide" icon={Star} tone="orange" />
        <StatCard label="Total reviews" value={reviews.length} hint="All stores" icon={Store} tone="purple" />
        <StatCard label="Flagged" value={reviews.filter((row) => row.is_flagged).length} hint="Reported by vendors" icon={Flag} tone="red" />
        <StatCard label="Hidden" value={reviews.filter((row) => row.is_hidden).length} hint="Not shown to customers" icon={EyeOff} tone="blue" />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search store, product or customer"
            className="min-w-0 flex-1 rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={cn(
                "rounded-full px-3.5 py-2 text-[12px] font-semibold transition",
                filter === entry.key
                  ? "bg-[#2B0B4D] text-white"
                  : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-3 space-y-2">
        {visible.length === 0 ? (
          <EmptyState
            title="Nothing to moderate"
            description="Customer reviews show up here as soon as they are submitted."
          />
        ) : (
          visible.map((review) => (
            <AdminReviewItem key={review.id} review={review} onModerate={act} />
          ))
        )}
      </section>
    </ConsoleShell>
  );
}