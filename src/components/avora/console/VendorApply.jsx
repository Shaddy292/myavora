import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { CATEGORIES } from "@/lib/avora";
import FieldSelect from "@/components/avora/FieldSelect";

const FIELDS = [
  { key: "name", label: "Business name", placeholder: "e.g. Mama Nkechi Kitchen" },
  { key: "tagline", label: "What you sell", placeholder: "Nigerian home cooking" },
  { key: "address", label: "Store address", placeholder: "14 Bode Thomas, Surulere" },
  { key: "area", label: "Area / zone", placeholder: "Surulere" },
  { key: "phone", label: "Contact phone", placeholder: "0803 000 0000" },
];

export default function VendorApply({ onSubmitted }) {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ category: "Restaurants" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await db.entities.Store.create({
        ...form,
        owner_email: user.email,
        owner_name: user.full_name || user.email,
        delivery_fee: 500,
        rating: 0,
        eta_min: 25,
        eta_max: 40,
        is_approved: false,
        is_open: false,
      });
      await router.invalidate();
      onSubmitted?.();
    } catch (err) {
      setError(err?.message || "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
      <h2 className="font-display text-[18px] font-bold text-[#1B1024]">Open your store on AVORA</h2>
      <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
        Tell us about your business. Our operations team reviews new stores within 24 hours.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]">
              {field.label}
            </span>
            <input
              required={field.key !== "tagline"}
              value={form[field.key] ?? ""}
              onChange={set(field.key)}
              placeholder={field.placeholder}
              className="mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[13.5px] text-[#1B1024] outline-none focus:border-[#4B2080]"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]">Category</span>
          <FieldSelect
            value={form.category}
            onChange={(value) => setForm({ ...form, category: value })}
            options={CATEGORIES.map((c) => ({ value: c.label, label: c.label }))}
            className="mt-1 text-[13.5px]"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-[12.5px] font-medium text-[#A11D1D]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-[#2B0B4D] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {busy ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}