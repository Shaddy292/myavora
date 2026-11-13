import { createFileRoute, Link } from "@tanstack/react-router";
import CustomerShell from "@/components/avora/CustomerShell";
import VendorApply from "@/components/avora/console/VendorApply";
import { getConsoleContext } from "@/lib/avora-fns";
import { Bike, CheckCircle2, ClipboardList, Clock3, Percent, Store } from "lucide-react";

export const Route = createFileRoute("/_authed/become-a-vendor")({
  loader: async () => {
    const context = await getConsoleContext();
    return { context };
  },
  head: () => ({ meta: [{ title: "Become a vendor · AVORA" }] }),
  component: BecomeVendor,
});

const STEPS = [
  { title: "Apply", body: "Share your business name, category, address and contact phone.", icon: ClipboardList },
  { title: "Verification", body: "Operations reviews your details — usually within 24 hours.", icon: Clock3 },
  { title: "Build your menu", body: "Add items, prices and stock in the vendor console.", icon: Store },
  { title: "Start delivering", body: "Orders land on your board and riders collect from your door.", icon: Bike },
];

function BecomeVendor() {
  const { context } = Route.useLoaderData();
  const store = context.store;

  return (
    <CustomerShell>
      <div className="rounded-2xl bg-[#2B0B4D] p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Partnership</p>
        <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em]">Sell on AVORA</h1>
        <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-white/75">
          Join the restaurants, groceries and pharmacies delivering across Nigeria. You keep the kitchen running — we bring the
          orders, riders and payouts.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11.5px] font-semibold">
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
            <Percent className="h-3.5 w-3.5" /> 10% commission
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">₦30,000 joining fee</span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">₦2,000/month platform fee</span>
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
            <Bike className="h-3.5 w-3.5" /> Our riders
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Weekly settlements
          </span>
        </div>
      </div>

      {store ? (
        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[18px] font-bold text-[#1B1024]">
            {store.is_approved ? "Your store is live" : "Application received"}
          </h2>
          <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
            {store.name} · {store.category} · {store.area || store.address}
          </p>
          <p className="mt-1 text-[11.5px] text-[#8A5200]">
            {store.join_fee_paid
              ? "Joining fee settled · ₦2,000 monthly platform fee applies"
              : "₦30,000 joining fee outstanding — finance confirms it before your store goes live"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                store.is_approved ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FFF4E3] text-[#A95400]"
              }`}
            >
              {store.is_approved ? "Approved" : "Pending verification"}
            </span>
            {store.review_note && <span className="text-[11.5px] text-[#9A8CA8]">{store.review_note}</span>}
          </div>
          <Link
            to="/vendor"
            className="mt-4 inline-block rounded-full bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]"
          >
            Open vendor console
          </Link>
        </section>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <VendorApply />
          <div className="space-y-3">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">How it works</h2>
              <ol className="mt-3 space-y-3">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4EEFA] text-[11px] font-bold text-[#3B0A66]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#1B1024]">
                        <step.icon className="h-3.5 w-3.5 text-[#FF7A00]" /> {step.title}
                      </p>
                      <p className="text-[11.5px] leading-relaxed text-[#8B7A9C]">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <p className="px-1 text-[11.5px] leading-relaxed text-[#9A8CA8]">
              Questions before applying? Read the vendor guide in the{" "}
              <Link to="/help-center" className="font-bold text-[#3B0A66]">
                help center
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}