import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-settings")({
  loader: async () => {
    const [context, rows] = await Promise.all([
      getConsoleContext(),
      db.entities.PlatformSetting.list("-updated_date", 1),
    ]);
    return { context, setting: rows[0] ?? null };
  },
  head: () => ({ meta: [{ title: "Platform settings · AVORA admin" }] }),
  component: AdminSettings,
});

const INPUT =
  "mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] text-[#1B1024] outline-none focus:border-[#4B2080]";
const LABEL = "block text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9A8CA8]";
const CARD = "rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]";

const TOGGLES = [
  { key: "auto_approve_vendors", label: "Auto-approve new vendors", hint: "Stores go live without manual review" },
  { key: "allow_cash_on_delivery", label: "Allow cash on delivery", hint: "Riders collect payment at the door" },
  { key: "maintenance_mode", label: "Maintenance mode", hint: "Pause new orders while you work on the platform" },
];

const NUMBERS = [
  { key: "service_fee_pct", label: "Service fee (%)", hint: "Added to every order total" },
  { key: "delivery_base_fee", label: "Base delivery fee", hint: "Default per-delivery charge" },
  { key: "min_order_value", label: "Minimum order value", hint: "Smallest basket customers can checkout" },
  { key: "rider_payout_base", label: "Rider payout base", hint: "Paid to the rider per delivery" },
  { key: "vendor_commission_pct", label: "Vendor commission (%)", hint: "AVORA's share of vendor sales" },
  { key: "rider_commission_pct", label: "Rider commission (%)", hint: "AVORA's share of the delivery fee" },
  { key: "vendor_join_fee", label: "Vendor joining fee", hint: "One-off fee charged at registration" },
  { key: "vendor_monthly_fee", label: "Vendor monthly fee", hint: "Deducted from payouts every month" },
];

const DEFAULTS = {
  business_name: "AVORA",
  legal_name: "",
  support_email: "",
  support_phone: "",
  service_fee_pct: "5",
  delivery_base_fee: "500",
  min_order_value: "1000",
  rider_payout_base: "700",
  vendor_commission_pct: "10",
  rider_commission_pct: "10",
  vendor_join_fee: "30000",
  vendor_monthly_fee: "2000",
  auto_approve_vendors: false,
  allow_cash_on_delivery: true,
  maintenance_mode: false,
  ops_note: "",
};

function AdminSettings() {
  const { context, setting } = Route.useLoaderData();
  const router = useRouter();
  const [draft, setDraft] = useState(() => ({
    ...DEFAULTS,
    business_name: setting?.business_name ?? DEFAULTS.business_name,
    legal_name: setting?.legal_name ?? "",
    support_email: setting?.support_email ?? "",
    support_phone: setting?.support_phone ?? "",
    service_fee_pct: String(setting?.service_fee_pct ?? 5),
    delivery_base_fee: String(setting?.delivery_base_fee ?? 500),
    min_order_value: String(setting?.min_order_value ?? 1000),
    rider_payout_base: String(setting?.rider_payout_base ?? 700),
    vendor_commission_pct: String(setting?.vendor_commission_pct ?? 10),
    rider_commission_pct: String(setting?.rider_commission_pct ?? 10),
    vendor_join_fee: String(setting?.vendor_join_fee ?? 30000),
    vendor_monthly_fee: String(setting?.vendor_monthly_fee ?? 2000),
    auto_approve_vendors: !!setting?.auto_approve_vendors,
    allow_cash_on_delivery: setting ? !!setting.allow_cash_on_delivery : true,
    maintenance_mode: !!setting?.maintenance_mode,
    ops_note: setting?.ops_note ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="settings" badge="Operations" title="Platform settings" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const save = async (event) => {
    event.preventDefault();
    if (!draft.business_name.trim()) {
      toast.error("Give your business a name");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        business_name: draft.business_name.trim(),
        legal_name: draft.legal_name.trim(),
        support_email: draft.support_email.trim(),
        support_phone: draft.support_phone.trim(),
        service_fee_pct: Number(draft.service_fee_pct) || 0,
        delivery_base_fee: Math.round(Number(draft.delivery_base_fee) || 0),
        min_order_value: Math.round(Number(draft.min_order_value) || 0),
        rider_payout_base: Math.round(Number(draft.rider_payout_base) || 0),
        vendor_commission_pct: Number(draft.vendor_commission_pct) || 0,
        rider_commission_pct: Number(draft.rider_commission_pct) || 0,
        vendor_join_fee: Math.round(Number(draft.vendor_join_fee) || 0),
        vendor_monthly_fee: Math.round(Number(draft.vendor_monthly_fee) || 0),
        auto_approve_vendors: draft.auto_approve_vendors,
        allow_cash_on_delivery: draft.allow_cash_on_delivery,
        maintenance_mode: draft.maintenance_mode,
        ops_note: draft.ops_note.trim(),
        updated_by: context.user.email,
      };
      if (setting) await db.entities.PlatformSetting.update(setting.id, payload);
      else await db.entities.PlatformSetting.create(payload);
      toast.success("Platform settings saved");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save the settings");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="settings"
      badge="Operations"
      title="Platform settings"
      subtitle="Business details, fees and operational switches"
      role={context.role}
    >
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Business details</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Shown to customers and on receipts.</p>
          <div className="mt-3 grid gap-3">
            <div>
              <label className={LABEL} htmlFor="business_name">Business name</label>
              <input id="business_name" value={draft.business_name} onChange={(e) => set("business_name", e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL} htmlFor="legal_name">Registered legal name</label>
              <input id="legal_name" value={draft.legal_name} onChange={(e) => set("legal_name", e.target.value)} className={INPUT} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="support_email">Support email</label>
                <input id="support_email" value={draft.support_email} onChange={(e) => set("support_email", e.target.value)} className={INPUT} placeholder="help@avora.ng" />
              </div>
              <div>
                <label className={LABEL} htmlFor="support_phone">Support phone</label>
                <input id="support_phone" value={draft.support_phone} onChange={(e) => set("support_phone", e.target.value)} className={INPUT} />
              </div>
            </div>
          </div>
        </section>

        <section className={CARD}>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Fees & payouts</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Defaults used across pricing and settlements.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {NUMBERS.map((item) => (
              <div key={item.key}>
                <label className={LABEL} htmlFor={item.key}>{item.label}</label>
                <input
                  id={item.key}
                  type="number"
                  min="0"
                  value={draft[item.key]}
                  onChange={(e) => set(item.key, e.target.value)}
                  className={INPUT}
                />
                <p className="mt-1 text-[10.5px] text-[#A797B4]">{item.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5 ring-1 ring-[#F1E9F7]">
            <p className="text-[11px] text-[#8B7A9C]">
              A {formatNGN(Number(draft.min_order_value) || 0)} basket would carry a{" "}
              {formatNGN(Number(draft.delivery_base_fee) || 0)} delivery fee plus{" "}
              {draft.service_fee_pct || 0}% service fee.
            </p>
          </div>
        </section>

        <section className={CARD}>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Operational preferences</h2>
          <div className="mt-3 space-y-2">
            {TOGGLES.map((item) => (
              <label key={item.key} className="flex items-start gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5 ring-1 ring-[#F1E9F7]">
                <input
                  type="checkbox"
                  checked={!!draft[item.key]}
                  onChange={(e) => set(item.key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#2B0B4D]"
                />
                <span>
                  <span className="block text-[12.5px] font-bold text-[#2B0B4D]">{item.label}</span>
                  <span className="block text-[11px] text-[#9A8CA8]">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className={`${CARD} flex flex-col`}>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Internal note</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Only staff see this — not customers or vendors.</p>
          <textarea
            value={draft.ops_note}
            onChange={(e) => set("ops_note", e.target.value)}
            rows={4}
            placeholder="Escalation contacts, opening hours, policy reminders…"
            className={`${INPUT} flex-1 resize-none`}
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#2B0B4D] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? "Saving…" : "Save settings"}
          </button>
        </section>
      </form>
    </ConsoleShell>
  );
}