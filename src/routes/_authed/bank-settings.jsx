import { createFileRoute } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import PayoutAccountCard from "@/components/avora/PayoutAccountCard";
import { getConsoleContext } from "@/lib/avora-fns";
import { getMyPayoutAccount } from "@/lib/payout-fns";
import { RIDER_NAV, VENDOR_NAV } from "@/lib/console-nav";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authed/bank-settings")({
  loader: async () => {
    const context = await getConsoleContext();
    const subject = context.role === "vendor" ? "vendor" : context.role === "rider" ? "rider" : null;
    const account = subject ? await getMyPayoutAccount({ data: { subject_type: subject } }) : null;
    return { context, subject, account };
  },
  head: () => ({ meta: [{ title: "Bank details · AVORA" }] }),
  component: BankSettings,
});

function BankSettings() {
  const { context, subject, account } = Route.useLoaderData();
  const isVendor = context.role === "vendor";
  const nav = isVendor ? VENDOR_NAV : RIDER_NAV;
  const active = isVendor ? "bank" : "riderBank";

  if (!subject) {
    return (
      <ConsoleShell nav={nav} active={active} badge="Payouts" title="Bank details" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      nav={nav}
      active={active}
      badge={isVendor ? "Vendor console" : "Rider console"}
      title="Payout bank account"
      subtitle="Where your settlements are paid out"
      role={context.role}
    >
      <div className="max-w-xl">
        <PayoutAccountCard
          subjectType={subject}
          account={account}
          defaultName={context.rider?.full_name || context.store?.owner_name || context.user?.full_name || ""}
        />
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#F4F0FB] px-4 py-3 text-[12px] leading-relaxed text-[#4B2080] ring-1 ring-[#E6DCF5]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Your account number is only used to send your payouts. Changes take effect from your next settlement, so
          double-check the number before saving.
        </p>
      </div>
    </ConsoleShell>
  );
}