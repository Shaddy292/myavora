import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { ADMIN_NAV } from "@/lib/console-nav";
import { adminStaffBoard, getConsoleContext, removeStaffMember, saveStaffMember } from "@/lib/avora-fns";
import { ROLE_LABEL } from "@/lib/avora";
import { Mail, Plus, Trash2, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-staff")({
  loader: async () => {
    const context = await getConsoleContext();
    const isAdmin = context.role === "admin";
    const board = isAdmin ? await adminStaffBoard() : null;
    return { context, isAdmin, board };
  },
  head: () => ({ meta: [{ title: "Staff management · AVORA admin" }] }),
  component: AdminStaff,
});

const ROLES = ["support", "ops", "finance", "admin"];
const BLANK = { email: "", full_name: "", role: "support" };

function AdminStaff() {
  const { context, isAdmin, board } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveStaffMember);
  const remove = useServerFn(removeStaffMember);
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="staff" badge="Operations" title="Staff management" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const staff = board.staff;

  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    const email = draft.email.trim();
    const role = draft.role;
    try {
      await save({ data: { email, full_name: draft.full_name.trim(), role } });
      setDraft(BLANK);
      await router.invalidate();
      try {
        await db.users.inviteUser(email, "user");
        toast.success(`${email} added as ${ROLE_LABEL[role] ?? role} — invite sent to set their password`);
      } catch (error) {
        toast.warning(`${email} added, but the invite email failed. Use Invite on their row to resend.`);
      }
    } catch (error) {
      toast.error(error?.message || "Could not add this staff member");
    } finally {
      setBusy(false);
    }
  };

  const invite = async (email) => {
    try {
      await db.users.inviteUser(email, "user");
      toast.success(`Invite sent to ${email}`);
    } catch (error) {
      toast.error(error?.message || "Could not send the invite");
    }
  };

  const patch = async (member, changes, message) => {
    try {
      await save({
        data: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
          role: member.role,
          is_active: member.is_active !== false,
          ...changes,
        },
      });
      toast.success(message);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this staff member");
    }
  };

  const drop = async (member) => {
    try {
      await remove({ data: { id: member.id } });
      toast.success(`${member.email} removed`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not remove this staff member");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="staff"
      badge="Operations"
      title="Staff management"
      subtitle={`${staff.length} team members with console access`}
      role={context.role}
    >
      <form onSubmit={add} className="rounded-2xl bg-white p-4 ring-1 ring-[#EDE5F4]">
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
          <UserCog className="h-4 w-4 text-[#4B2080]" /> Add a team member
        </h2>
        <p className="mt-1 text-[12px] text-[#8B7A9C]">
          Work email is required. Adding a member creates their staff record and emails an invite link where they set their own password, then sign in with it.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            required
            type="email"
            value={draft.email}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            placeholder="Work email (required)"
            list="avora-members"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <datalist id="avora-members">
            {board.members.map((member) => (
              <option key={member.email} value={member.email}>
                {member.full_name}
              </option>
            ))}
          </datalist>
          <input
            value={draft.full_name}
            onChange={(event) => setDraft({ ...draft, full_name: event.target.value })}
            placeholder="Full name"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <FieldSelect
            value={draft.role}
            onChange={(value) => setDraft({ ...draft, role: value })}
            options={ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
            className="mt-0 h-10"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Add member"}
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-2xl bg-white ring-1 ring-[#EDE5F4]">
        {staff.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No staff yet" description="Add your first support or operations agent above." />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {staff.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-[#1B1024]">{member.full_name || member.email}</p>
                  <p className="truncate text-[11.5px] text-[#8B7A9C]">{member.email}</p>
                </div>
                <FieldSelect
                  value={member.role}
                  onChange={(value) => patch(member, { role: value }, "Role updated")}
                  options={ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }))}
                  ariaLabel={`Role for ${member.email}`}
                  className="mt-0 h-9 w-[124px] rounded-lg text-[12px] font-semibold"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      member,
                      { is_active: member.is_active === false },
                      member.is_active === false ? "Access restored" : "Access suspended"
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    member.is_active === false ? "bg-[#FDECEC] text-[#A11D1D]" : "bg-[#E7F6EC] text-[#15693F]"
                  }`}
                >
                  {member.is_active === false ? "Suspended" : "Active"}
                </button>
                <button
                  type="button"
                  onClick={() => invite(member.email)}
                  className="flex items-center gap-1 rounded-full bg-[#F4EEFA] px-2.5 py-1 text-[11px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5]"
                >
                  <Mail className="h-3 w-3" /> Invite
                </button>
                <button
                  type="button"
                  onClick={() => drop(member)}
                  className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Remove ${member.email}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[11.5px] text-[#9A8CA8]">
        Admins see every console. Operations handles orders and verification, finance handles money, support handles tickets.
      </p>
    </ConsoleShell>
  );
}