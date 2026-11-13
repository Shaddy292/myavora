import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { Image } from "@/components/ui/image";
import { CATEGORIES, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Bike, Clock, MapPin, Search, Star } from "lucide-react";

export const Route = createFileRoute("/_authed/store-directory")({
  loader: async () => {
    const [page, categoryPage] = await Promise.all([
      db.entities.Store.filter({ is_approved: true }, { sort: "-rating", limit: 100 }),
      db.entities.Category.filter({ is_active: true }, { sort: "position", limit: 60 }),
    ]);
    return {
      stores: page.items ?? page,
      managed: categoryPage.items ?? categoryPage,
    };
  },
  head: () => ({ meta: [{ title: "Store directory · AVORA" }] }),
  component: StoreDirectory,
});

const RATINGS = [
  { key: 0, label: "Any rating" },
  { key: 4, label: "4.0 and up" },
  { key: 4.5, label: "4.5 and up" },
];

function StoreDirectory() {
  const { stores, managed } = Route.useLoaderData();
  const [category, setCategory] = useState("all");
  const [rating, setRating] = useState(0);
  const [query, setQuery] = useState("");

  // Admin-managed categories set the order; store categories not yet in the
  // manager still show so no store is unreachable.
  const categories = useMemo(() => {
    const managedNames = managed.map((entry) => entry.name);
    const extra = [...new Set(stores.map((store) => store.category).filter(Boolean))].filter(
      (name) => !managedNames.includes(name)
    );
    const fallback = managed.length ? [] : CATEGORIES.map((entry) => entry.label);
    return ["all", ...managedNames, ...fallback.filter((name) => !managedNames.includes(name)), ...extra];
  }, [stores, managed]);

  const emojiFor = (name) =>
    managed.find((entry) => entry.name === name)?.emoji ??
    CATEGORIES.find((entry) => entry.label === name)?.emoji ??
    "🍽️";

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return stores.filter((store) => {
      const matchesCategory = category === "all" || store.category === category;
      const matchesRating = (store.rating ?? 0) >= rating;
      const matchesQuery =
        !term || `${store.name} ${store.tagline ?? ""} ${store.area ?? ""} ${store.category}`.toLowerCase().includes(term);
      return matchesCategory && matchesRating && matchesQuery;
    });
  }, [stores, category, rating, query]);

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Store directory</h1>
      <p className="text-[13px] text-[#8B7A9C]">
        {stores.length} approved stores delivering across Nigeria. Filter by category or rating.
      </p>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center gap-2 rounded-full bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
          <Search className="h-4 w-4 text-[#9A8CA8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search store, area or what you crave"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setCategory(entry)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                category === entry ? "bg-[#2B0B4D] text-white" : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry === "all" ? "All categories" : entry}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-[#EFE7F6]" />
          {RATINGS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setRating(entry.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                rating === entry.key
                  ? "bg-[#FFF1E4] text-[#B05C00] ring-1 ring-[#FFE2BC]"
                  : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="No stores match those filters" description="Try a wider rating or a different category." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((store) => (
            <Link
              key={store.id}
              to="/store-menu"
              search={{ store: store.id }}
              className="group overflow-hidden rounded-2xl bg-white ring-1 ring-[#F1E9F7] transition hover:ring-[#D9C6EA]"
            >
              {store.cover_url ? (
                <Image src={store.cover_url} alt={store.name} className="h-28 w-full" fittingType="fill" />
              ) : (
                <div className="flex h-28 w-full items-center justify-center bg-[#F6EEFB] text-[38px]">
                  {emojiFor(store.category)}
                </div>
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-display text-[14px] font-bold text-[#1B1024]">{store.name}</p>
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#FFF6E8] px-1.5 py-0.5 text-[11px] font-bold text-[#A95400]">
                    <Star className="h-3 w-3 fill-[#FFB020] text-[#FFB020]" /> {store.rating ?? "—"}
                  </span>
                </div>
                <p className="truncate text-[11.5px] text-[#8B7A9C]">{store.tagline || store.category}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#5B4A6B]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#1F7A4C]" /> {store.eta_min ?? 20}–{store.eta_max ?? 35} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Bike className="h-3 w-3 text-[#FF7A00]" />
                    {store.delivery_fee ? formatNGN(store.delivery_fee) : "Free"}
                  </span>
                  {store.area && (
                    <span className="flex items-center gap-1 text-[#9A8CA8]">
                      <MapPin className="h-3 w-3" /> {store.area}
                    </span>
                  )}
                </div>
                {store.promo && (
                  <p className="mt-2 inline-block rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[10.5px] font-bold text-[#15693F]">
                    {store.promo}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </CustomerShell>
  );
}