import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import Logo from "@/components/avora/Logo";
import BackButton from "@/components/avora/BackButton";
import RiderApply from "@/components/avora/console/RiderApply";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Store, Truck } from "lucide-react";

export const Route = createFileRoute("/register-rider")({
  ssr: false,
  head: () => ({ meta: [{ title: "Become an AVORA rider · AVORA" }] }),
  component: RegisterRider,
});

const STEPS = [
  "Create your AVORA account with your email",
  "Add your vehicle, ID and zone",
  "Upload your documents in the rider profile",
  "Get approved and start accepting deliveries",
];

function RegisterRider() {
  const { user, isLoadingAuth } = useAuth();
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    db.entities.RiderProfile.filter({ user_email: user.email }, { limit: 1 })
      .then((result) => setRider((Array.isArray(result) ? result : result.items ?? [])[0] ?? null))
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
        <Link to="/register-vendor" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5B4A6B] hover:text-[#2B0B4D]">
          <Store className="h-3.5 w-3.5" /> Register a store
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-12 md:px-6">
        <div className="rounded-[26px] bg-[#FF7A00] px-5 py-7 text-white md:px-8 md:py-9">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
            <Truck className="h-3 w-3" /> Rider registration
          </span>
          <h1 className="font-display mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[36px]">
            Ride on your own schedule, get paid weekly.
          </h1>
          <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/85">
            Pick your shifts, deliver across your zone, and track every payout in the rider console.
          </p>
        </div>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-[#EFE7F6]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF1E4] text-[11px] font-bold text-[#B05C00]">
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
              <h2 className="font-display text-[17px] font-bold text-[#1B1024]">Create your rider account</h2>
              <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
                Sign up with your email and verify the code we send — your rider application opens straight after.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/register?returnTo=%2Fregister-rider"
                  className="flex items-center gap-1.5 rounded-xl bg-[#FF7A00] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00]"
                >
                  Create account <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href="/login?returnTo=%2Fregister-rider"
                  className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-[#3B0A66] ring-1 ring-[#E4D9EE] transition hover:bg-[#F8F5FC]"
                >
                  I already have an account
                </a>
              </div>
              <p className="mt-3 text-[11.5px] text-[#A797B4]">
                Want to order instead? <a href="/register" className="font-semibold text-[#3B0A66] underline">Register as a customer</a>.
              </p>
            </section>
          ) : rider ? (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display flex items-center gap-2 text-[17px] font-bold text-[#1B1024]">
                <CheckCircle2 className={cn("h-5 w-5", rider.status === "approved" ? "text-[#1F7A4C]" : "text-[#B05C00]")} />
                {rider.full_name}
              </h2>
              <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
                {rider.status === "approved"
                  ? "You are approved — go online in the rider console to start receiving jobs."
                  : `Your rider account is ${rider.status}. Upload your documents to speed up the review.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/rider-profile" className="rounded-xl bg-[#FF7A00] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00]">
                  Upload documents
                </Link>
                <Link to="/rider" className="rounded-xl bg-white px-5 py-2.5 text-[13px] font-bold text-[#3B0A66] ring-1 ring-[#E4D9EE]">
                  Open rider console
                </Link>
              </div>
            </section>
          ) : (
            <RiderApply onSubmitted={setRider} />
          )}
        </div>
      </main>
    </div>
  );
}