import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import FieldSelect from "@/components/avora/FieldSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMyPayoutAccount } from "@/lib/payout-fns";

const BANKS = [
  "Access Bank",
  "Access Bank (Diamond)",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "Globus Bank",
  "Guaranty Trust Bank",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Microfinance Bank",
  "Moniepoint MFB",
  "OPay Digital Services",
  "Optimus Bank",
  "Palmpay",
  "Parallex Bank",
  "Polaris Bank",
  "Premium Trust Bank",
  "Providus Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "TAJBank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
];

const BANK_OPTIONS = BANKS.map((bank) => ({ value: bank, label: bank }));

export default function PayoutAccountCard({ subjectType, account, defaultName }) {
  const router = useRouter();
  const save = useServerFn(saveMyPayoutAccount);
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountName, setAccountName] = useState(account?.account_name ?? defaultName ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!bankName) {
      toast.error("Choose your bank");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { subject_type: subjectType, bank_name: bankName, account_name: accountName, account_number: accountNumber } });
      toast.success(account ? "Payout account updated" : "Payout account saved");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save your payout account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4EEFA] text-[#4B2080]">
          <Landmark className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Payout account</h2>
          <p className="text-[11.5px] text-[#8B7A9C]">
            Daily payouts are sent to this account. Update it any time before the payout runs.
          </p>
        </div>
      </div>

      {account && (
        <div className="mt-3 rounded-xl bg-[#FBF8F3] px-3.5 py-2.5 ring-1 ring-[#F1E9F7]">
          <p className="text-[12px] font-semibold text-[#1B1024]">
            {account.bank_name} · {account.account_number}
          </p>
          <p className="text-[11px] text-[#8B7A9C]">
            {account.account_name} · {account.is_verified ? "Verified" : "Awaiting verification"}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${subjectType}-bank`} className="text-[12px] font-semibold text-[#5B4A6B]">
            Bank
          </Label>
          <FieldSelect
            id={`${subjectType}-bank`}
            value={bankName}
            onChange={setBankName}
            options={BANK_OPTIONS}
            placeholder="Select your bank"
            ariaLabel="Bank"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor={`${subjectType}-account-name`} className="text-[12px] font-semibold text-[#5B4A6B]">
            Account name
          </Label>
          <Input
            id={`${subjectType}-account-name`}
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
            placeholder="Name on the account"
            className="mt-1 h-11 rounded-xl text-[12.5px]"
            required
          />
        </div>
        <div>
          <Label htmlFor={`${subjectType}-account-number`} className="text-[12px] font-semibold text-[#5B4A6B]">
            Account number
          </Label>
          <Input
            id={`${subjectType}-account-number`}
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="0123456789"
            inputMode="numeric"
            className="mt-1 h-11 rounded-xl text-[12.5px]"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-xl bg-primary px-4 text-[13px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {busy ? "Saving…" : account ? "Update payout account" : "Save payout account"}
          </button>
        </div>
      </form>
    </section>
  );
}