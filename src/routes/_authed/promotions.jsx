import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { CATEGORIES, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Bike, Copy, Tag, Ticket } from "lucide-react";

export const Route = createFileRoute("/_authed/promotions")({
  loader: async () => {
    const page = await db.entities.Store.filter({ is_approved: true }, { sort: "-rating", limit: 100 });
    return { stores: page.items ?? page };
  },
  head: () => ({ meta: [{ title: "Offers & promo codes · AVORA" }] }),
  component: Promotions,
});

function Promotions() {
  const { stores } = Route.useLoaderData();
  const [category, setCategory] = useState("all");

  const withCode = stores.filter((store) => store.promo);
  const freeDelivery = stores.filter((store) => !store.delivery_fee);

  const visible = useMemo(
    () => withCode.filter((store) => category === "all" || store.category === category),
    [withCode, category]
  );

  const categories = ["all", ...new Set(withCode.map((store) => store.category).filter(Boolean))];

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Code ${code} copied`);
    } catch {
      toast.error("Copy the code manually: " + code);
    }
  };

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Offers & promo codes</h1>
      <p className="text-[13px] text-[#8B7A9C]">Live discounts from participating stores — tap a code to copy it.</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {categories.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setCategory(entry)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              category === entry
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {entry === "all" ? "All offers" : entry}
          </button>
        ))}
      </div>

      <section className="mt-4">
        <h2 className="flex items-center gap-1.5 font-display text-[16px] font-bold text-[#1B1024]">
          <Ticket className="h-4 w-4 text-[#FF7A00]" /> Promo codes
        </h2>
        {visible.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No promo codes right now"
              description="Stores publish codes here when they run a campaign. Free delivery offers are below."
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((store) => (
              <article key={store.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#F1E9F7]">
                <div className="flex items-center gap-2 bg-[#2B0B4D] px-3 py-2 text-white">
                  <Tag className="h-3.5 w-3.5" />
                  <p className="truncate text-[12.5px] font-bold">{store.promo}</p>
                </div>
                <div className="p-3">
                  <p className="truncate font-display text-[14px] font-bold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11.5px] text-[#8B7A9C]">
                    {store.category} · {store.area || "Nigeria"}
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#9A8CA8]">
                    Min order {formatNGN(store.min_order)} · delivery {store.delivery_fee ? formatNGN(store.delivery_fee) : "free"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Link
                      to="/store-menu"
                      search={{ store: store.id }}
                      className="flex-1 rounded-full bg-[#FF7A00] px-3 py-1.5 text-center text-[11.5px] font-bold text-white transition hover:bg-[#F06E00]"
                    >
                      Order now
                    </Link>
                    <button
                      type="button"
                      onClick={() => copy(store.promo)}
                      className="flex items-center gap-1 rounded-full bg-[#F4EEFA] px-2.5 py-1.5 text-[11.5px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5]"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <h2 className="flex items-center gap-1.5 font-display text-[16px] font-bold text-[#1B1024]">
          <Bike className="h-4 w-4 text-[#1F7A4C]" /> Free delivery stores
        </h2>
        {freeDelivery.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-[#9A8CA8]">No stores are running free delivery today.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {freeDelivery.map((store) => (
              <Link
                key={store.id}
                to="/store-menu"
                search={{ store: store.id }}
                className="flex items-center gap-2.5 rounded-2xl bg-white p-3 ring-1 ring-[#F1E9F7] transition hover:ring-[#D9C6EA]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF6EF] text-[18px]">
                  {CATEGORIES.find((entry) => entry.label === store.category)?.emoji ?? "🍽️"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-[#1B1024]">{store.name}</p>
                  <p className="text-[11px] text-[#1F7A4C]">Free delivery · {store.eta_min ?? 20}–{store.eta_max ?? 35} min</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </CustomerShell>
  );
}