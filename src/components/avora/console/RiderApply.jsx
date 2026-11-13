import { useState } from "react";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import FieldSelect from "@/components/avora/FieldSelect";

const VEHICLES = [
  { value: "bike", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
];

const FIELDS = [
  { key: "full_name", label: "Full name", placeholder: "Tunde Adeyemi" },
  { key: "phone", label: "Phone number", placeholder: "0803 000 0000" },
  { key: "plate_number", label: "Plate / bike number", placeholder: "LAG-123-XY" },
  { key: "id_type", label: "ID type", placeholder: "NIN, Driver's licence…" },
  { key: "id_number", label: "ID number", placeholder: "12345678901" },
  { key: "zone", label: "Preferred zone", placeholder: "Yaba / Surulere" },
];

export default function RiderApply({ onSubmitted }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ vehicle_type: "bike" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await db.entities.RiderProfile.create({
        ...form,
        user_email: user.email,
        status: "pending",
        is_online: false,
      });
      onSubmitted?.(created);
    } catch (err) {
      setError(err?.message || "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-[#EFE7F6]">
      <h2 className="font-display text-[18px] font-bold text-[#1B1024]">Ride with AVORA</h2>
      <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
        We verify every rider's identity and vehicle before the first delivery.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]">
              {field.label}
            </span>
            <input
              required={field.key !== "plate_number"}
              value={form[field.key] ?? ""}
              onChange={set(field.key)}
              placeholder={field.placeholder}
              className="mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[13.5px] text-[#1B1024] outline-none focus:border-[#4B2080]"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]">Vehicle</span>
          <FieldSelect
            value={form.vehicle_type}
            onChange={(value) => setForm({ ...form, vehicle_type: value })}
            options={VEHICLES}
            placeholder="Choose a vehicle"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-[12.5px] font-medium text-[#A11D1D]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-[#FF7A00] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60 sm:w-auto sm:px-6"
      >
        {busy ? "Submitting…" : "Submit rider application"}
      </button>
    </form>
  );
}