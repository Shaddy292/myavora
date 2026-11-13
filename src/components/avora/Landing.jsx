import { Link } from "@tanstack/react-router";
import { ArrowRight, Bike, MapPin, Pill, ShieldCheck, ShoppingBasket, Sparkles, Store, UtensilsCrossed } from "lucide-react";
import Logo, { LogoMark } from "@/components/avora/Logo";
import { Button } from "@/components/ui/button";

const SERVICES = [
  {
    icon: UtensilsCrossed,
    title: "Restaurant food",
    body: "Jollof, pizza, local dishes and late-night cravings from kitchens near you.",
  },
  {
    icon: ShoppingBasket,
    title: "Groceries & essentials",
    body: "Supermarket runs, fresh produce and household staples in one basket.",
  },
  {
    icon: Pill,
    title: "Pharmacy",
    body: "Medicines and health essentials delivered when it matters most.",
  },
];

const STEPS = [
  { title: "Browse", body: "Pick a store near you and fill your basket." },
  { title: "Order", body: "Check out in seconds and pay your way." },
  { title: "Track", body: "Follow your rider live from kitchen to doorstep." },
];

// The marketing landing page for anonymous visitors on "/". Signed-in
// customers get the storefront instead (see src/routes/index.jsx).
export function Landing({ storeCount = 0 }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link to="/" aria-label="AVORA home">
          <Logo className="h-8" />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="h-10 font-medium">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild className="h-10 font-medium">
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-2 md:px-6">
        <div className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#2B0B4D_0%,#3E0E63_48%,#5B1478_100%)] px-5 py-10 text-white md:px-12 md:py-16">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#FF7A00]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#1F7A4C]/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFD9B8] ring-1 ring-white/15">
              <Sparkles className="h-3 w-3" /> Delivered in minutes
            </span>
            <h1 className="font-display mt-4 text-[36px] font-extrabold leading-[1.03] tracking-[-0.035em] md:text-[56px]">
              Whatever you crave,
              <br />
              <span className="text-[#FF9E3D]">at your door.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-white/70 md:text-[16px]">
              Restaurants, supermarkets and pharmacies across Nigeria — one basket, one
              delivery, live tracking from kitchen to doorstep. Open every day, 8am – 11pm.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-[#FF7A00] px-6 font-bold text-white hover:bg-[#F06E00]">
                <Link to="/register">
                  Create a free account <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/25 bg-transparent px-6 font-semibold text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] font-medium text-white/60">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#8FD8B0]" /> Verified riders
              </span>
              <span className="flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5 text-[#FF9E3D]" /> Live order tracking
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-white/60" /> Across Nigeria
              </span>
              {storeCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-white/60" /> {storeCount} local {storeCount === 1 ? "store" : "stores"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-foreground md:text-[24px]">
          One app, everything delivered
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[22px] bg-card p-5 ring-1 ring-border">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <p className="font-display mt-3 text-[15px] font-bold text-foreground">{title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="rounded-[26px] bg-card p-5 ring-1 ring-border md:p-7">
          <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-foreground md:text-[22px]">
            How AVORA works
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {STEPS.map(({ title, body }, index) => (
              <div key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[14px] font-bold text-foreground">{title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARTNER BAND */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/register-vendor"
            className="group flex items-center justify-between rounded-[26px] bg-[#1F7A4C] px-5 py-6 text-white transition hover:bg-[#1A6A42]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">For businesses</p>
              <p className="font-display mt-1 text-[17px] font-bold">Sell on AVORA</p>
              <p className="mt-0.5 text-[12.5px] text-white/70">Own your store, reach more doors.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </Link>
          <Link
            to="/register-rider"
            className="group flex items-center justify-between rounded-[26px] bg-[#FF7A00] px-5 py-6 text-white transition hover:bg-[#F06E00]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">For riders</p>
              <p className="font-display mt-1 text-[17px] font-bold">Ride with AVORA</p>
              <p className="mt-0.5 text-[12.5px] text-white/80">Flexible hours, daily payouts.</p>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="flex flex-col items-center rounded-[26px] bg-[#2B0B4D] px-6 py-10 text-center text-white">
          <LogoMark className="h-12 w-auto" />
          <h2 className="font-display mt-4 text-[24px] font-extrabold tracking-[-0.03em] md:text-[32px]">
            Hungry? You are minutes away.
          </h2>
          <p className="mt-2 max-w-md text-[13.5px] text-white/70">
            Create an account, pick a store near you and track your order live to your doorstep.
          </p>
          <Button asChild size="lg" className="mt-6 h-12 rounded-full bg-[#FF7A00] px-6 font-bold text-white hover:bg-[#F06E00]">
            <Link to="/register">
              Get started <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto mt-12 max-w-6xl border-t border-border px-4 py-8 md:px-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-auto" />
            <p className="max-w-[240px] text-[12px] leading-relaxed text-muted-foreground">
              AVORA delivers food and groceries across Nigeria, every day 8am – 11pm.
            </p>
          </div>
          <p className="text-[11.5px] text-muted-foreground">© 2026 AVORA Delivery. Prices in Naira (₦).</p>
        </div>
      </footer>
    </div>
  );
}
