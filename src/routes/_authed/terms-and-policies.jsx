import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import CustomerShell from "@/components/avora/CustomerShell";
import { cn } from "@/lib/utils";
import { FileText, Lock, Truck } from "lucide-react";

export const Route = createFileRoute("/_authed/terms-and-policies")({
  head: () => ({
    meta: [
      { title: "Terms & policies · AVORA" },
      { name: "description", content: "Terms of service, privacy policy and delivery guidelines for AVORA customers, vendors and riders." },
    ],
  }),
  component: TermsAndPolicies,
});

const AUDIENCES = [
  { key: "customers", label: "Customers" },
  { key: "vendors", label: "Vendors" },
  { key: "riders", label: "Riders" },
];

const SECTIONS = {
  customers: [
    {
      icon: FileText,
      title: "Terms of service",
      body: [
        "AVORA connects you with local stores and independent riders. The store is responsible for the goods and the rider for the delivery.",
        "Orders are confirmed once payment is authorised or cash on delivery is accepted. Prices, delivery fees and service fees are shown before you pay.",
        "You may cancel while an order is still marked as placed or accepted. After the store starts preparing, cancellations are reviewed case by case.",
      ],
    },
    {
      icon: Lock,
      title: "Privacy policy",
      body: [
        "We store your name, contact details, delivery addresses and order history so orders can be fulfilled and supported.",
        "Riders see only the delivery address, order contents and a contact number for the active trip. Vendors see the items to prepare.",
        "You can request deletion of your account data at any time through the support center.",
      ],
    },
    {
      icon: Truck,
      title: "Delivery guidelines",
      body: [
        "Deliveries run daily 8am – 11pm across Nigeria. Estimated times are shown per store and refresh live.",
        "Please provide a reachable phone number and a clear address label. Two failed contact attempts may cancel the order.",
        "Report missing or damaged items within 24 hours of delivery so we can open a refund review.",
      ],
    },
  ],
  vendors: [
    {
      icon: FileText,
      title: "Partner terms",
      body: [
        "Stores list accurate prices, stock and preparation times. Menu items hidden from customers must be marked unavailable.",
        "Commission is calculated per delivered order at the rate agreed during onboarding and deducted from each settlement.",
        "Orders should be accepted or rejected within five minutes. Repeated missed orders can pause your storefront.",
      ],
    },
    {
      icon: Lock,
      title: "Data & privacy",
      body: [
        "You see customer name, delivery area and order contents — never full payment credentials.",
        "Customer data may only be used to prepare and hand over the order. Marketing to customers outside AVORA is not permitted.",
      ],
    },
    {
      icon: Truck,
      title: "Fulfilment guidelines",
      body: [
        "Pack orders so items arrive in the condition they were sold. Seal drinks and separate hot and cold items.",
        "Mark an order ready only when it is packed and waiting for a rider. Riders are dispatched from the nearest zone.",
        "Settlements are generated weekly and paid to the bank account on your vendor profile.",
      ],
    },
  ],
  riders: [
    {
      icon: FileText,
      title: "Rider agreement",
      body: [
        "Riders are independent partners. You choose your shifts and zones, and accept the jobs you can complete.",
        "A valid government ID, vehicle papers and insurance must be on file before your first delivery.",
        "Payouts are earned per completed delivery and released through weekly rider settlements.",
      ],
    },
    {
      icon: Lock,
      title: "Safety & privacy",
      body: [
        "Customer contact details are visible only during an active delivery and must not be stored or reused.",
        "Helmets and reflective gear are required on every trip. Report accidents immediately through the rider console.",
        "Cash collected on delivery is recorded against your profile and offset from your next payout.",
      ],
    },
    {
      icon: Truck,
      title: "Delivery standards",
      body: [
        "Confirm pickup with store staff, then update the order to picked up so the customer sees live progress.",
        "Deliver to the address in the app. If the customer is unreachable, contact support before marking a failure.",
        "Repeated late pickups, spoilt goods or unverified deliveries can suspend an account pending review.",
      ],
    },
  ],
};

function TermsAndPolicies() {
  const [audience, setAudience] = useState("customers");
  const sections = SECTIONS[audience];

  return (
    <CustomerShell>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">The fine print</p>
      <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Terms & policies</h1>
      <p className="text-[13px] text-[#8B7A9C]">
        How AVORA works for customers, vendors and riders — updated 26 October 2026.
      </p>

      <div className="mt-4 flex gap-1.5">
        {AUDIENCES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setAudience(entry.key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              audience === entry.key ? "bg-[#2B0B4D] text-white" : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3ECFB] text-[#4B2080]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {section.title}
              </h2>
              <ul className="mt-2.5 space-y-2">
                {section.body.map((paragraph) => (
                  <li key={paragraph} className="flex gap-2 text-[12.5px] leading-relaxed text-[#5B4A6B]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C9B6DA]" />
                    {paragraph}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-5 rounded-2xl bg-[#F8F5FC] px-4 py-3 text-[11.5px] leading-relaxed text-[#8B7A9C]">
        These summaries explain how AVORA operates day to day. For a formal copy of any agreement, contact
        support from your account and our team will send the current version.
      </p>
    </CustomerShell>
  );
}