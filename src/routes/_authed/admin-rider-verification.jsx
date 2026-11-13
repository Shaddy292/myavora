import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { getConsoleContext, reviewRider } from "@/lib/avora-fns";
import { adminRiderBoard, adminSetRiderDocs } from "@/lib/partner-admin-fns";
import { ADMIN_NAV } from "@/lib/console-nav";
import { BadgeCheck, FileText, X } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-rider-verification")({
  loader: async () => {
    const context = await getConsoleContext();
    if (context.role !== "admin") return { context, riders: [] };
    const { riders } = await adminRiderBoard();
    return { context, riders };
  },
  head: () => ({ meta: [{ title: "Rider verification · AVORA admin" }] }),
  component: AdminRiderVerification,
});

const FILTERS = [
  { key: "pending", label: "Awaiting review" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All riders" },
];

const DOCS = [
  { key: "id_document_uri", label: "ID document" },
  { key: "license_uri", label: "Driver's licence" },
  { key: "vehicle_doc_uri", label: "Vehicle papers" },
  { key: "insurance_uri", label: "Insurance" },
];

const DOCS_TONE = {
  missing: "bg-[#F4F0FB] text-[#5B4A70]",
  submitted: "bg-[#FFF4E3] text-[#A95400]",
  verified: "bg-[#E7F6EC] text-[#15693F]",
  rejected: "bg-[#FDECEC] text-[#A11D1D]",
};

function AdminRiderVerification() {
  const { context, riders } = Route.useLoaderData();
  const router = useRouter();
  const decide = useServerFn(reviewRider);
  const setDocs = useServerFn(adminSetRiderDocs);
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState("");

  if (context.role !== "admin") {
    return (
      <ConsoleShell
        nav={ADMIN_NAV}
        active="riderChecks"
        badge="Operations"
        title="Rider verification"
        role={context.role}
      >
        <Denied />
      </ConsoleShell>
    );
  }

  const pending = riders.filter((rider) => rider.status === "pending");
  const approved = riders.filter((rider) => rider.status === "approved");
  const visible = filter === "pending" ? pending : filter === "approved" ? approved : riders;

  const run = async (id, action, success) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this rider");
    } finally {
      setBusyId("");
    }
  };

  const openDoc = async (uri) => {
    try {
      const { signed_url } = await db.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
      window.open(signed_url, "_blank", "noopener");
    } catch (error) {
      toast.error(error?.message || "Could not open that document");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="riderChecks"
      badge="Operations"
      title="Rider verification"
      subtitle={`${pending.length} riders awaiting review · ${approved.length} approved couriers`}
      role={context.role}
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={`rounded-full px-3.5 py-2 text-[12px] font-bold transition ${
              filter === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#8B7A9C] ring-1 ring-[#EFE7F6] hover:text-[#1B1024]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={filter === "pending" ? "No riders waiting" : "No riders here"}
              description="Rider applications arrive with their ID, licence and vehicle documents for review."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {visible.map((rider) => {
              const missingDocs = DOCS.filter((doc) => !rider[doc.key]).length;
              const docsStatus = rider.docs_status ?? "missing";
              return (
                <li key={rider.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[#1B1024]">{rider.full_name}</p>
                      <p className="text-[11.5px] text-[#8B7A9C]">
                        {rider.vehicle_type}
                        {rider.plate_number ? ` · ${rider.plate_number}` : ""} · {rider.zone || "No zone"}
                      </p>
                      <p className="text-[11.5px] text-[#9A8CA8]">
                        {rider.id_type || "ID"} {rider.id_number ? `· ${rider.id_number}` : ""} · {rider.phone}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            rider.status === "approved"
                              ? "bg-[#E7F6EC] text-[#15693F]"
                              : rider.status === "rejected" || rider.status === "suspended"
                                ? "bg-[#FDECEC] text-[#A11D1D]"
                                : "bg-[#FFF4E3] text-[#A95400]"
                          }`}
                        >
                          {rider.status}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 ${DOCS_TONE[docsStatus]}`}>
                          docs {docsStatus}
                        </span>
                        {missingDocs > 0 && (
                          <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[#A11D1D]">
                            {missingDocs} missing
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!rider.is_approved && rider.status === "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            run(
                              rider.id,
                              () => decide({ data: { rider_id: rider.id, decision: "approve" } }),
                              `${rider.full_name} approved`
                            )
                          }
                          disabled={busyId === rider.id}
                          className="flex items-center gap-1 rounded-full bg-[#1F7A4C] px-3 py-2 text-[11.5px] font-bold text-white disabled:opacity-60"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" /> Approve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            rider.id,
                            () =>
                              setDocs({
                                data: { rider_id: rider.id, docs_status: docsStatus === "verified" ? "rejected" : "verified" },
                              }),
                            docsStatus === "verified" ? "Documents rejected" : "Documents verified"
                          )
                        }
                        disabled={busyId === rider.id}
                        className="flex items-center gap-1 rounded-full bg-[#F4F0FB] px-3 py-2 text-[11.5px] font-bold text-[#4B2080] disabled:opacity-60"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {docsStatus === "verified" ? "Reject docs" : "Verify docs"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            rider.id,
                            () => decide({ data: { rider_id: rider.id, decision: "reject" } }),
                            "Rider rejected"
                          )
                        }
                        disabled={busyId === rider.id}
                        className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-[11.5px] font-bold text-[#A11D1D] ring-1 ring-[#F0C7C7] disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DOCS.map((doc) =>
                      rider[doc.key] ? (
                        <button
                          key={doc.key}
                          type="button"
                          onClick={() => openDoc(rider[doc.key])}
                          className="rounded-lg bg-[#FBF8F3] px-2.5 py-1.5 text-[11px] font-semibold text-[#4B2080] ring-1 ring-[#F1E9F7] hover:bg-[#F4F0FB]"
                        >
                          {doc.label}
                        </button>
                      ) : (
                        <span
                          key={doc.key}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#B9AEC7] ring-1 ring-dashed ring-[#EFE7F6]"
                        >
                          {doc.label} not uploaded
                        </span>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ConsoleShell>
  );
}