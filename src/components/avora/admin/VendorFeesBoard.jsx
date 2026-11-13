import { Banknote, CalendarClock, Percent, Repeat } from "lucide-react";
import { formatNGN } from "@/lib/avora";

const KIND_LABEL = { join_fee: "Joining fee", subscription: "Monthly fee" };

function Mini({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-[#FBF8F3] p-3 ring-1 ring-[#F1E9F7]">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9A8CA8]">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold text-[#2B0B4D]">{value}</p>
      {hint && <p className="text-[10.5px] text-[#9A8CA8]">{hint}</p>}
    </div>
  );
}

export default function VendorFeesBoard({ board, busy, onPay, onWaive, onRun }) {
  if (!board) return null;
  const { fees, period, charges, totals } = board;

  return (
    <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Vendor fees</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">
            {fees.vendorPct}% sales commission · {fees.riderPct}% rider commission ·{" "}
            {formatNGN(fees.joinFee)} joining fee · {formatNGN(fees.monthlyFee)}/month · billing
            period {period}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-60"
        >
          Run monthly billing
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Mini label="Joining fees in" value={formatNGN(totals.joinCollected)} hint={`${totals.awaitingFee} vendors outstanding`} />
        <Mini label="Monthly fees in" value={formatNGN(totals.subCollected)} hint={`${formatNGN(totals.mrr)} recurring`} />
        <Mini label="Unpaid charges" value={formatNGN(totals.outstanding)} hint="Deducted at next payout" />
        <Mini label="Live vendors" value={String(totals.vendors)} hint="Approved stores" />
      </div>

      {charges.length === 0 ? (
        <p className="mt-3 rounded-xl bg-[#FBF8F3] px-3 py-4 text-center text-[12px] text-[#9A8CA8]">
          No vendor charges yet — they are raised automatically when a store applies.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#F3ECF9]">
          {charges.slice(0, 12).map((charge) => (
            <li key={charge.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4EEFA] text-[#3B0A66]">
                {charge.kind === "join_fee" ? (
                  <Banknote className="h-4 w-4" />
                ) : (
                  <Repeat className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">
                  {charge.store_name || charge.owner_email}
                </p>
                <p className="text-[11px] text-[#9A8CA8]">
                  {KIND_LABEL[charge.kind] || charge.kind}
                  {charge.period ? ` · ${charge.period}` : ""} · {charge.reference}
                  {charge.status === "due" && charge.due_date ? ` · due ${charge.due_date}` : ""}
                </p>
              </div>
              <span className="text-[12px] font-bold text-[#2B0B4D]">{formatNGN(charge.amount)}</span>
              {charge.status === "due" ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPay(charge)}
                    className="rounded-full bg-[#1F7A4C] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                  >
                    Mark paid
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onWaive(charge)}
                    className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] disabled:opacity-60"
                  >
                    Waive
                  </button>
                </div>
              ) : (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                    charge.status === "paid"
                      ? "bg-[#E7F6EC] text-[#15693F]"
                      : "bg-[#F4EEFA] text-[#5B3C7A]"
                  }`}
                >
                  {charge.status === "paid" ? "Paid" : "Waived"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#9A8CA8]">
        <span className="flex items-center gap-1">
          <Percent className="h-3.5 w-3.5 text-[#FF7A00]" /> Commission applies to delivered orders
        </span>
        <span className="flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5 text-[#3B0A66]" /> Monthly fee is taken from the
          vendor payout before it is sent
        </span>
      </div>
    </section>
  );
}