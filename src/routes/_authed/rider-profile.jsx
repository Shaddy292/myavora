import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import RiderApply from "@/components/avora/console/RiderApply";
import FieldSelect from "@/components/avora/FieldSelect";
import { RIDER_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { saveRiderDocuments } from "@/lib/insight-fns";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { FileCheck2, Loader2, ShieldCheck, Upload } from "lucide-react";

export const Route = createFileRoute("/_authed/rider-profile")({
  loader: () => getConsoleContext(),
  head: () => ({ meta: [{ title: "Rider verification · AVORA" }] }),
  component: RiderProfilePage,
});

const VEHICLES = [
  { value: "bike", label: "Motorcycle" },
  { value: "bicycle", label: "Bicycle" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van" },
];

const DOCS = [
  { key: "id_document_uri", label: "Government ID", hint: "NIN slip, driver's licence or passport" },
  { key: "license_uri", label: "Rider licence", hint: "Rider association card or licence" },
  { key: "vehicle_doc_uri", label: "Vehicle papers", hint: "Registration or proof of ownership" },
  { key: "insurance_uri", label: "Insurance certificate", hint: "Valid bike or vehicle insurance" },
];

const DOC_TONE = {
  missing: "bg-[#FDECEC] text-[#A11D1D]",
  submitted: "bg-[#FFF4E3] text-[#A95400]",
  verified: "bg-[#E7F6EC] text-[#15693F]",
  rejected: "bg-[#FDECEC] text-[#A11D1D]",
};

function RiderProfilePage() {
  const context = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveRiderDocuments);
  const rider = context.rider;
  const [form, setForm] = useState(() => ({
    full_name: rider?.full_name ?? "",
    phone: rider?.phone ?? "",
    vehicle_type: rider?.vehicle_type ?? "bike",
    plate_number: rider?.plate_number ?? "",
    id_type: rider?.id_type ?? "",
    id_number: rider?.id_number ?? "",
    insurance_expiry: rider?.insurance_expiry ?? "",
    id_document_uri: rider?.id_document_uri ?? "",
    license_uri: rider?.license_uri ?? "",
    vehicle_doc_uri: rider?.vehicle_doc_uri ?? "",
    insurance_uri: rider?.insurance_uri ?? "",
  }));
  const [uploading, setUploading] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const upload = async (key, file) => {
    if (!file) return;
    setUploading(key);
    try {
      const { file_uri } = await db.integrations.Core.UploadPrivateFile({ file });
      setForm((current) => ({ ...current, [key]: file_uri }));
      toast.success("Document uploaded — remember to save");
    } catch (error) {
      toast.error(error?.message || "Could not upload that file");
    } finally {
      setUploading("");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Verification details saved");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save your details");
    } finally {
      setBusy(false);
    }
  };

  if (!rider) {
    return (
      <ConsoleShell nav={RIDER_NAV} active="profile" badge="Rider console" title="Rider profile" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <RiderApply />
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="profile"
      badge="Rider console"
      title="Verification centre"
      subtitle={`${rider.full_name} · account ${rider.status}`}
      role={context.role}
    >
      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#4B2080]" />
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Document status</h2>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]", DOC_TONE[rider.docs_status ?? "missing"])}>
            {(rider.docs_status ?? "missing").replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
          Upload clear photos or PDFs. Files are stored privately — only AVORA operations can open them.
        </p>
        {rider.docs_submitted_at && (
          <p className="mt-1 text-[11.5px] text-[#9A8CA8]">Last submitted {formatDateTime(rider.docs_submitted_at)}</p>
        )}
        {rider.review_note && (
          <p className="mt-2 rounded-xl bg-[#FFF8ED] px-3 py-2 text-[12px] text-[#8A5A15]">Reviewer note: {rider.review_note}</p>
        )}
      </section>

      <form onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Vehicle & identity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <input value={form.full_name} onChange={set("full_name")} className={INPUT} required />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={set("phone")} className={INPUT} required />
            </Field>
            <Field label="Vehicle">
              <FieldSelect
                value={form.vehicle_type}
                onChange={(value) => setForm({ ...form, vehicle_type: value })}
                options={VEHICLES}
                className="mt-1 text-[13px]"
              />
            </Field>
            <Field label="Plate number">
              <input value={form.plate_number} onChange={set("plate_number")} className={INPUT} placeholder="LAG-123-XY" />
            </Field>
            <Field label="ID type">
              <input value={form.id_type} onChange={set("id_type")} className={INPUT} placeholder="NIN, licence…" />
            </Field>
            <Field label="ID number">
              <input value={form.id_number} onChange={set("id_number")} className={INPUT} />
            </Field>
            <Field label="Insurance expiry">
              <input type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} className={INPUT} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Documents</h2>
          <div className="mt-3 space-y-2">
            {DOCS.map((doc) => {
              const uploaded = Boolean(form[doc.key]);
              return (
                <label
                  key={doc.key}
                  className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5 ring-1 ring-[#F1E9F7]"
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", uploaded ? "bg-[#E7F6EC] text-[#15693F]" : "bg-white text-[#A797B4]")}>
                    {uploading === doc.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-[#1B1024]">{doc.label}</span>
                    <span className="block text-[11px] text-[#9A8CA8]">
                      {uploaded ? "Uploaded — replace anytime" : doc.hint}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#3B0A66] ring-1 ring-[#EDE5F4]">
                    <Upload className="h-3 w-3" /> Choose
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(event) => upload(doc.key, event.target.files?.[0])}
                  />
                </label>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-[#2B0B4D] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save verification details"}
          </button>
        </section>
      </form>
    </ConsoleShell>
  );
}

const INPUT =
  "mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[13px] text-[#1B1024] outline-none focus:border-[#4B2080]";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]">{label}</span>
      {children}
    </label>
  );
}