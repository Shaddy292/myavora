import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ArrowRight, Sparkles, Store, Bike, ShieldCheck } from "lucide-react";
import TopBar from "@/components/avora/TopBar";
import BottomNav from "@/components/avora/BottomNav";
import StoreCard from "@/components/avora/StoreCard";
import CategoryRail from "@/components/avora/CategoryRail";
import ProductTile from "@/components/avora/ProductTile";
import { LogoMark } from "@/components/avora/Logo";
import { Landing } from "@/components/avora/Landing";
import { Image } from "@/components/ui/image";
import PullToRefresh from "@/components/avora/PullToRefresh";
import { getSiteContent } from "@/lib/insight-fns";
import { homeFeed } from "@/lib/catalog-fns";
import { visitor } from "@/lib/session-fns";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [content, feed, user] = await Promise.all([getSiteContent(), homeFeed(), visitor()]);
    return { content, feed, user };
  },
  component: Home,
  head: () => ({
    meta: [
    { title: "AVORA — Food & groceries delivered across Nigeria" },
    {
      name: "description",
      content:
      "Order from restaurants, supermarkets and pharmacies near you. AVORA delivers food and groceries across Nigeria, every day 8am – 11pm."
    }]

  })
});

const ANNOUNCE_TONE = {
  purple: "bg-[#2B0B4D] text-white",
  orange: "bg-[#FF7A00] text-white",
  green: "bg-[#1F7A4C] text-white"
};

function Home() {
  const { content, feed, user } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null);
  const categories = content?.featured_categories?.length ? content.featured_categories : feed?.categories ?? [];
  const essentials = feed?.essentials ?? [];
  const banners = (content?.banners ?? []).filter(
    (banner) => banner.is_active !== false && (banner.image_url || banner.title)
  );

  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (feed?.stores ?? []).filter(
      (s) =>
      (!category || s.category === category) && (
      !q ||
      `${s.name} ${s.tagline ?? ""} ${s.area ?? ""} ${s.category ?? ""}`.toLowerCase().includes(q))
    );
  }, [feed, query, category]);

  // Anonymous visitors get the marketing landing page; signed-in customers
  // land on the storefront.
  if (!user) return <Landing storeCount={feed?.storeCount ?? 0} />;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <TopBar />
      <PullToRefresh />

      {content?.announcement_active && content.announcement_title &&
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
          <div className={`rounded-2xl px-4 py-3 ${ANNOUNCE_TONE[content.announcement_tone] ?? ANNOUNCE_TONE.purple}`}>
            <p className="text-[13px] font-bold">{content.announcement_title}</p>
            {content.announcement_body && <p className="mt-0.5 text-[12px] text-white/75">{content.announcement_body}</p>}
          </div>
        </div>
      }

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-5 md:px-6 md:pt-8">
        <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#2B0B4D_0%,#3E0E63_48%,#5B1478_100%)] px-5 py-8 text-white md:px-12 md:py-14">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#FF7A00]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#1F7A4C]/20 blur-3xl" />

          <div className="relative max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFD9B8] ring-1 ring-white/15">
              <Sparkles className="h-3 w-3" /> Delivered in minutes
            </span>
            <h1 className="font-display mt-4 text-[34px] font-extrabold leading-[1.03] tracking-[-0.035em] md:text-[52px]">
              Whatever you crave,
              <br />
              <span className="text-[#FF9E3D]">at your door.</span>
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70 md:text-[15px]">
              Restaurants, supermarkets and pharmacies across Nigeria — one basket, one
              delivery, live tracking from kitchen to doorstep. Open every day, 8am – 11pm.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                document.getElementById("stores")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-6 flex items-center gap-2 rounded-full bg-white p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]">
              <Search className="ml-3 h-5 w-5 shrink-0 text-[#9A8CA8]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “jollof”, “pizza” or “tomatoes”"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]" />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#FF7A00] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00]">
                Find
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] font-medium text-white/60">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#8FD8B0]" /> Verified riders
              </span>
              <span className="flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5 text-[#FF9E3D]" /> Live order tracking
              </span>
              {feed?.storeCount > 0 &&
              <span className="flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-white/60" /> {feed.storeCount} local{" "}
                  {feed.storeCount === 1 ? "store" : "stores"}
                </span>
              }
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      {categories.length > 0 &&
      <section className="mx-auto max-w-6xl px-4 pt-7 md:px-6">
          <CategoryRail items={categories} active={category} onSelect={setCategory} />
        </section>
      }

      {banners.length > 0 &&
      <section className="mx-auto max-w-6xl px-4 pt-5 md:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {banners.map((banner, index) => (
              <a
                key={`${banner.image_url || banner.title}-${index}`}
                href={banner.link || "/store-directory"}
                className="group relative block overflow-hidden rounded-[22px] bg-[#2B0B4D] ring-1 ring-[#F1E9F7]"
              >
                {banner.image_url ? (
                  <Image
                    src={banner.image_url}
                    alt={banner.title || "AVORA promotion"}
                    className="h-40 w-full"
                    fittingType="fill"
                  />
                ) : (
                  <div className="h-40 w-full bg-gradient-to-br from-[#3B1063] via-[#2B0B4D] to-[#42116F]" />
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 text-white">
                  {banner.title && <p className="font-display text-[16px] font-bold">{banner.title}</p>}
                  {banner.body && <p className="line-clamp-2 text-[12px] text-white/80">{banner.body}</p>}
                </div>
              </a>
            ))}
          </div>
        </section>
      }

      {/* STORES */}
      <section id="stores" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-8 md:px-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-foreground md:text-[24px]">
              {category ? `${category} near you` : "Popular near you"}
            </h2>
            <p className="text-[12.5px] text-muted-foreground">Delivering across Nigeria · 8am – 11pm daily</p>
          </div>
          <Link
            to="/store-directory"
            className="hidden items-center gap-1 text-[12.5px] font-bold text-primary hover:text-[#FF7A00] sm:flex">
            
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {stores.length === 0 ?
        <div className="rounded-3xl bg-card p-10 text-center ring-1 ring-border">
            <p className="font-display text-[16px] font-bold text-foreground">
              {query || category ? "Nothing here yet" : "No stores yet"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {query || category ?
              "Try another dish, store or category." :
              "Approved stores will show up here as soon as they join."}
            </p>
          </div> :

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) =>
          <StoreCard key={store.id} store={store} />
          )}
          </div>
        }
      </section>

      {/* ESSENTIALS */}
      {essentials.length > 0 &&
      <section id="essentials" className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
          <div className="rounded-[26px] bg-card p-4 ring-1 ring-border md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-foreground md:text-[22px]">
                Fresh from the shelves
              </h2>
              <Link
              to="/store-directory"
              className="text-[11.5px] font-bold text-primary hover:text-[#FF7A00]">
              
                Browse stores
              </Link>
            </div>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {essentials.map((item) =>
            <ProductTile key={item.id} item={item} />
            )}
            </div>
          </div>
        </section>
      }

      {/* PARTNER BAND */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/register-vendor"
            className="group flex items-center justify-between rounded-[26px] bg-[#1F7A4C] px-5 py-6 text-white transition hover:bg-[#1A6A42]">
            
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                For businesses
              </p>
              <p className="font-display mt-1 text-[17px] font-bold">Sell on AVORA</p>
              <p className="mt-0.5 text-[12.5px] text-white/70">Own your store, reach more doors.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </Link>
          <Link
            to="/register-rider"
            className="group flex items-center justify-between rounded-[26px] bg-[#FF7A00] px-5 py-6 text-white transition hover:bg-[#F06E00]">
            
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                For riders
              </p>
              <p className="font-display mt-1 text-[17px] font-bold">Ride with AVORA</p>
              <p className="mt-0.5 text-[12.5px] text-white/80">Flexible hours, daily payouts.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto mt-12 max-w-6xl border-t border-border px-4 py-8 md:px-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-auto" />
            <p className="max-w-[240px] text-[12px] leading-relaxed text-muted-foreground">AVORA delivers food and groceries across Nigeria, every day 8am – 11pm.

            </p>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            © 2026 AVORA Delivery. Prices in Naira (₦).
          </p>
        </div>
      </footer>

      <BottomNav active="home" />
    </div>);

}