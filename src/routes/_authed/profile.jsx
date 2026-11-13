import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import { useAuth } from "@/lib/AuthContext";
import { getConsoleContext } from "@/lib/avora-fns";
import { ROLE_LABEL } from "@/lib/avora";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, Mail, MapPin, Receipt, ShieldCheck, Trash2, User } from "lucide-react";

export const Route = createFileRoute("/_authed/profile")({
  loader: async () => {
    const [me, context, addresses] = await Promise.all([
      db.auth.me(),
      getConsoleContext(),
      db.entities.Address.list("-created_date", 5),
    ]);
    return { me, context, addresses };
  },
  head: () => ({ meta: [{ title: "Profile settings · AVORA" }] }),
  component: Profile,
});

function Profile() {
  const { me, context, addresses } = Route.useLoaderData();
  const { refresh, logout } = useAuth();
  const [fullName, setFullName] = useState(me.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.auth.updateMe({ full_name: fullName.trim() });
      await refresh();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error?.message || "Could not save your profile");
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async () => {
    setSending(true);
    try {
      await db.auth.resetPasswordRequest(me.email);
      toast.success(`Password reset link sent to ${me.email}`);
    } catch {
      toast.success(`If ${me.email} is on file, a reset link is on its way.`);
    } finally {
      setSending(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await db.auth.updateMe({ deletion_requested_at: new Date().toISOString() });
      toast.success("Account deletion requested. Signing you out…");
      logout();
    } catch (error) {
      toast.error(error?.message || "Could not request account deletion");
      setDeleting(false);
    }
  };

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Profile settings</h1>
      <p className="text-[13px] text-[#8B7A9C]">Your details, password and the addresses checkout uses.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-4">
          <form onSubmit={saveProfile} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Personal information</h2>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#9A8CA8]">
              Full name
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2">
              <User className="h-4 w-4 text-[#9A8CA8]" />
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#1B1024] outline-none"
              />
            </div>
            <label className="mt-3 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#9A8CA8]">
              Email
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#EFE7F6] bg-[#F8F5FC] px-3 py-2">
              <Mail className="h-4 w-4 text-[#9A8CA8]" />
              <span className="truncate text-[13px] font-medium text-[#5B4A6B]">{me.email}</span>
            </div>
            <button
              type="submit"
              disabled={busy || fullName.trim() === (me.full_name ?? "")}
              className="mt-3 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Password</h2>
            <p className="mt-1 text-[12.5px] text-[#8B7A9C]">
              We email you a secure link to set a new password.
            </p>
            <button
              type="button"
              onClick={sendResetLink}
              disabled={sending}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-[#FFF1E4] px-4 py-2 text-[12.5px] font-bold text-[#B05C00] transition hover:bg-[#FFE6CC] disabled:opacity-60"
            >
              <KeyRound className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Change password"}
            </button>
          </section>

          <section className="rounded-2xl border border-[#F3D9D9] bg-white p-4">
            <h2 className="font-display text-[15px] font-bold text-[#A11D1D]">Delete account</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#8B7A9C]">
              Closes your AVORA account. Your profile, saved addresses and order history are removed and this
              cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-[#FDECEC] px-4 py-2 text-[12.5px] font-bold text-[#A11D1D] transition hover:bg-[#F9DBDB]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete account
            </button>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Delivery addresses</h2>
              <Link to="/customer-addresses" className="text-[12px] font-bold text-[#3B0A66] hover:text-[#FF7A00]">
                Manage
              </Link>
            </div>
            {addresses.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-[#9A8CA8]">No addresses saved yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {addresses.map((address) => (
                  <li key={address.id} className="flex items-start gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A00]" />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-[#1B1024]">{address.label}</p>
                      <p className="truncate text-[11.5px] text-[#8B7A9C]">
                        {address.line1}
                        {address.area ? `, ${address.area}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-[#2B0B4D] p-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Account type</p>
            <p className="font-display mt-1 text-[18px] font-extrabold">{ROLE_LABEL[context.role] ?? "Customer"}</p>
            <p className="mt-1 text-[12px] text-white/70">
              {context.store ? `Vendor · ${context.store.name}` : context.rider ? "Approved rider" : "Customer account"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/order-history" className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-bold">
                <Receipt className="h-3.5 w-3.5" /> Orders
              </Link>
              {context.store && (
                <Link to="/vendor" className="rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-bold">
                  Vendor console
                </Link>
              )}
              {context.rider && (
                <Link to="/rider" className="rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-bold">
                  Rider console
                </Link>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
              <ShieldCheck className="h-4 w-4 text-[#1F7A4C]" /> Account security
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#8B7A9C]">
              Your sign-in email is verified. Sign out from the header if you are on a shared device.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display text-[15px] font-bold text-[#1B1024]">More settings</h2>
            <ul className="mt-2 divide-y divide-[#F3ECF9]">
              {[
                { to: "/payment-methods", label: "Payment methods" },
                { to: "/customer-addresses", label: "Address book" },
                { to: "/refund-management", label: "Refund requests" },
                { to: "/help-center", label: "Help center" },
                { to: "/become-a-vendor", label: "Become a vendor" },
              ].map((entry) => (
                <li key={entry.to}>
                  <Link
                    to={entry.to}
                    className="flex items-center justify-between py-2 text-[12.5px] font-semibold text-[#5B4A6B] transition hover:text-[#2B0B4D]"
                  >
                    {entry.label}
                    <span aria-hidden="true" className="text-[#C4B5D2]">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your AVORA account?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll remove your profile, addresses and order history. You'll be signed out straight away and this
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                deleteAccount();
              }}
              className="bg-[#A11D1D] text-white hover:bg-[#8C1717]"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomerShell>
  );
}