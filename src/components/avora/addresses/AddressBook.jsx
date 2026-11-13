import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { db } from "@/api/client";
import EmptyState from "@/components/avora/EmptyState";
import { Check, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

const BLANK = { label: "Home", line1: "", area: "", phone: "", notes: "" };

/** Customer address book: add, edit, delete and pick the primary delivery address. */
export default function AddressBook({ addresses }) {
  const router = useRouter();
  const [items, setItems] = useState(() => addresses);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  // Optimistic writes: the list changes on tap, and only a failed request rolls it back.
  const persist = async (run, successMessage, errorMessage, rollback) => {
    try {
      await run();
      toast.success(successMessage);
      await router.invalidate();
    } catch (error) {
      setItems(rollback);
      toast.error(error?.message || errorMessage);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.line1.trim().length < 3) {
      toast.error("Add a street address");
      return;
    }
    const previous = items;
    setBusy(true);
    setForm(null);

    if (form.id) {
      const { id, ...changes } = form;
      setItems((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
      await persist(() => db.entities.Address.update(id, changes), "Address updated", "Could not save the address", previous);
    } else {
      const draft = { ...form, id: `new-${Date.now()}`, is_default: items.length === 0 };
      setItems((current) => [...current, draft]);
      await persist(
        async () => {
          const created = await db.entities.Address.create({ ...form, is_default: draft.is_default });
          setItems((current) => current.map((row) => (row.id === draft.id ? created : row)));
        },
        "Address saved",
        "Could not save the address",
        previous
      );
    }

    setBusy(false);
  };

  const remove = async (address) => {
    const previous = items;
    setItems((current) => current.filter((row) => row.id !== address.id));
    await persist(() => db.entities.Address.delete(address.id), "Address deleted", "Could not delete the address", previous);
  };

  const makePrimary = async (address) => {
    const previous = items;
    const wasPrimary = items.filter((row) => row.id !== address.id && row.is_default);
    setItems((current) => current.map((row) => ({ ...row, is_default: row.id === address.id })));
    await persist(
      () =>
        Promise.all([
          db.entities.Address.update(address.id, { is_default: true }),
          ...wasPrimary.map((row) => db.entities.Address.update(row.id, { is_default: false })),
        ]),
      `${address.label} is now your primary address`,
      "Could not update the primary address",
      previous
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Address book</h1>
          <p className="text-[13px] text-[#8B7A9C]">
            Save the places you order to — checkout fills in your primary address for you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(form ? null : { ...BLANK })}
          className="flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66]"
        >
          <Plus className="h-3.5 w-3.5" /> {form ? "Close form" : "Add address"}
        </button>
      </div>

      {form && (
        <form onSubmit={save} className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">{form.id ? "Edit address" : "New address"}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: "label", placeholder: "Label (Home, Office)" },
              { key: "line1", placeholder: "Street address" },
              { key: "area", placeholder: "Area (Yaba)" },
              { key: "phone", placeholder: "Phone" },
            ].map((field) => (
              <input
                key={field.key}
                value={form[field.key] ?? ""}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                placeholder={field.placeholder}
                className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
            ))}
            <input
              value={form.notes ?? ""}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Delivery notes (gate, landmark)"
              className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080] sm:col-span-2"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 rounded-full bg-[#FF7A00] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
          >
            {busy ? "Saving…" : form.id ? "Save changes" : "Save address"}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No addresses yet"
            description="Add your home, office or any drop-off point — you can switch between them at checkout."
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((address) => (
            <div key={address.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
              <div className="flex items-start justify-between gap-2">
                <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-[#1B1024]">
                  <MapPin className="h-4 w-4 text-[#FF7A00]" /> {address.label}
                  {address.is_default && (
                    <span className="rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#15693F]">
                      Primary
                    </span>
                  )}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...address })}
                    className="text-[#8B7A9C] transition hover:text-[#2B0B4D]"
                    aria-label={`Edit ${address.label}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(address)}
                    className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                    aria-label={`Delete ${address.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B4A6B]">
                {address.line1}
                {address.area ? `, ${address.area}` : ""}
                {address.city ? `, ${address.city}` : ""}
              </p>
              {address.phone && <p className="text-[11.5px] text-[#9A8CA8]">{address.phone}</p>}
              {address.notes && <p className="mt-1 text-[11.5px] italic text-[#9A8CA8]">“{address.notes}”</p>}
              {!address.is_default && (
                <button
                  type="button"
                  onClick={() => makePrimary(address)}
                  className="mt-2 flex items-center gap-1 rounded-full bg-[#F4EEFA] px-3 py-1.5 text-[11.5px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5]"
                >
                  <Check className="h-3 w-3" /> Set as primary
                </button>
              )}
              {address.is_default && (
                <p className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-[#15693F]">
                  <Star className="h-3 w-3 fill-[#15693F]" /> Used automatically at checkout
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}