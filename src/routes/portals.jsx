import { createFileRoute, Link } from "@tanstack/react-router";
import Logo from "@/components/avora/Logo";
import BackButton from "@/components/avora/BackButton";
import { Bike, Headphones, ShieldCheck, ShoppingBag, Store } from "lucide-react";

export const Route = createFileRoute("/portals")({
  head: () => ({ meta: [{ title: "Sign in · AVORA portals" }] }),
  component: Portals,
});

const PORTALS = [
  {
    key: "customer",
    title: "Customer",
    blurb: "Order food and groceries, track riders, manage refunds.",
    to: "/",
    icon: ShoppingBag,
    tone: "bg-[#FFF1E4] text-[#B05C00]",
  },
  {
    key: "vendor",
    title: "Vendor",
    blurb: "Run your store board, menu, stock and settlements.",
    to: "/vendor",
    icon: Store,
    tone: "bg-[#F4EEFA] text-[#3B0A66]",
  },
  {
    key: "rider",
    title: "Rider",
    blurb: "Claim deliveries, navigate routes, track earnings.",
    to: "/rider",
    icon: Bike,
    tone: "bg-[#EAF6EF] text-[#15693F]",
  },
  {
    key: "support",
    title: "Support",
    blurb: "Work the ticket queue and answer customers.",
    to: "/support-tickets",
    icon: Headphones,
    tone: "bg-[#EEF1FF] text-[#2E3A9E]",
  },
  {
    key: "admin",
    title: "Administrator",
    blurb: "Platform oversight, finance, staff and audit trails.",
    to: "/admin",
    icon: ShieldCheck,
    tone: "bg-[#F6EEFB] text-[#4B2080]",
  },
];

function Portals() {
  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-16">
        <div className="mb-4">
          <BackButton fallbackTo="/" />
        </div>
        <Link to="/">
          <Logo className="h-10" />
        </Link>
        <h1 className="font-display mt-6 text-[30px] font-extrabold tracking-[-0.035em] text-[#1B1024]">
          Sign in to your portal
        </h1>
        <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-[#8B7A9C]">
          Every AVORA workspace has its own sign-in. Pick where you work and we will take you straight there after login.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {PORTALS.map((portal) => (
            <Link
              key={portal.key}
              to="/login"
              search={{ returnTo: portal.to }}
              className="group rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#4B2080]"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${portal.tone}`}>
                <portal.icon className="h-5 w-5" />
              </span>
              <p className="font-display mt-3 text-[16px] font-bold text-[#1B1024]">{portal.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#8B7A9C]">{portal.blurb}</p>
              <p className="mt-2.5 text-[12px] font-bold text-[#3B0A66] group-hover:text-[#FF7A00]">Sign in →</p>
            </Link>
          ))}

          <div className="rounded-2xl bg-[#2B0B4D] p-4 text-white">
            <p className="font-display text-[16px] font-bold">New to AVORA?</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/70">
              Pick the account that fits you — register as a customer, a vendor or a rider.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/register"
                className="rounded-full bg-[#FF7A00] px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-[#F06E00]"
              >
                Customer sign up
              </Link>
              <Link
                to="/register-vendor"
                className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-white/20"
              >
                Vendor sign up
              </Link>
              <Link
                to="/register-rider"
                className="rounded-full bg-white/10 px-3.5 py-2 text-[12px] font-bold text-white transition hover:bg-white/20"
              >
                Rider sign up
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11.5px] text-[#9A8CA8]">
          Staff accounts are created by an administrator in Staff management — there is no public sign-up for consoles.
        </p>
      </div>
    </div>
  );
}