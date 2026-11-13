import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import Logo from "@/components/avora/Logo";
import BackButton from "@/components/avora/BackButton";
import VendorApply from "@/components/avora/console/VendorApply";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Store, Truck } from "lucide-react";

export const Route = createFileRoute("/register-vendor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Register your store · AVORA" }] }),
  component: RegisterVendor,
});

const STEPS = [
  "Create your AVORA account with your email",
  "Tell us about your store and what you sell",
  "Operations reviews and approves you within 24 hours",
  "Publish your menu and start receiving orders",
];

function RegisterVendor() {
  const { user, isLoadingAuth } = useAuth();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    db.entities.Store.filter({ owner_email: user.email }, { limit: 1 })
      .then((result) => setStore((Array.isArray(result) ? result : result.items ?? [])[0] ?? null))
      .finally(() => setLoading(false));
  }, [user?.email]);

  return (
    <div className="min-h-screen bg-[#FBF8F3]">
      <div className="mx-auto max-w-4xl px-4 pt-4 md:px-6">
        <BackButton fallbackTo="/" />
      </div>
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 md:px-6">
        <Link to="/">
          <Logo className="h-9" />
        </Link>
        <Link to="/register-rider" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5B4A6B] hover:text-[#2B0B4D]">
          <Truck className="h-3.5 w-3.5" /> Register as a rider
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-12 md:px-6">
        <div className="rounded-[26px] bg-[#1F7A4C] px-5 py-7 text-white md:px-8 md:py-9">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            <Store className="h-3 w-3" /> Vendor registration
          </span>
          <h1 className="font-display mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">
            Bring your kitchen, shop or pharmacy to AVORA.
          </h1>
          <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/75">
            Reach customers across Nigeria, manage your menu live, and get weekly settlements straight to your bank.
          </p>
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-[#EFE7F6]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAF6EF] text-[11px] font-bold text-[#1F7A4C]">
                {index + 1}
              </span>
              <span className="text-[12.5px] font-medium text-[#5B4A6B]">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5">
          {isLoadingAuth || loading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-[#EFE7F6]" />
          ) : !user ? (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display text-[17px] font-bold text-[#1B1024]">Create your vendor account</h2>
              <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
                Sign up with your email, verify the code we send, and your store application opens straight away.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/register?returnTo=%2Fregister-vendor"
                  className="flex items-center gap-1.5 rounded-xl bg-[#1F7A4C] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1A6A42]"
                >
                  Create account <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href="/login?returnTo=%2Fregister-vendor"
                  className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-[#3B0A66] ring-1 ring-[#E4D9EE] transition hover:bg-[#F8F5FC]"
                >
                  I already have an account
                </a>
              </div>
              <p className="mt-3 text-[11.5px] text-[#A797B4]">
                Just ordering? <a href="/register" className="font-semibold text-[#3B0A66] underline">Register as a customer</a> instead.
              </p>
            </section>
          ) : store ? (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display flex items-center gap-2 text-[17px] font-bold text-[#1B1024]">
                <CheckCircle2 className={cn("h-5 w-5", store.is_approved ? "text-[#1F7A4C]" : "text-[#B05C00]")} />
                {store.name}
              </h2>
              <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
                {store.is_approved
                  ? "Your store is approved. Head to the vendor console to publish your menu and go live."
                  : "Your application is with our operations team. You will be able to publish once approved."}
              </p>
              {store.review_note && <p className="mt-2 text-[12px] text-[#8A5A15]">Note: {store.review_note}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={store.is_approved ? "/vendor" : "/vendor-products"}
                  className="rounded-xl bg-[#1F7A4C] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1A6A42]"
                >
                  Open vendor console
                </Link>
                <Link to="/vendor-analytics" className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-[#3B0A66] ring-1 ring-[#E4D9EE]">
                  See analytics
                </Link>
              </div>
            </section>
          ) : (
            <VendorApply />
          )}
        </div>
      </main>
    </div>
  );
}