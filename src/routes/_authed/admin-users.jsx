import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { accountDirectory, setAccountRole } from "@/lib/platform-fns";
import { cn } from "@/lib/utils";
import { Bike, Search, ShieldCheck, Store, Users } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-users")({
  loader: async () => {
    const context = await getConsoleContext();
    const directory = await accountDirectory();
    return { context, directory };
  },
  head: () => ({ meta: [{ title: "User management · AVORA admin" }] }),
  component: AdminUsers,
});

const FILTERS = [
  { key: "all", label: "All accounts" },
  { key: "customer", label: "Customers" },
  { key: "vendor", label: "Vendors" },
  { key: "rider", label: "Riders" },
  { key: "admin", label: "Admins" },
];

function accountKind(account) {
  if (account.role === "admin") return "admin";
  if (account.store_name) return "vendor";
  if (account.rider_status) return "rider";
  return "customer";
}

function AdminUsers() {
  const { context, directory } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(setAccountRole);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const accounts = directory.accounts;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return accounts.filter((account) => {
      const kind = accountKind(account);
      const matchesFilter = filter === "all" || kind === filter;
      const matchesQuery =
        !term ||
        `${account.full_name ?? ""} ${account.email ?? ""} ${account.store_name ?? ""}`.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [accounts, filter, query]);

  if (!directory.admin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="users" badge="Operations" title="User management" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const changeRole = async (account, role) => {
    try {
      await save({ data: { id: account.id, role } });
      toast.success(`${account.email} is now ${role === "admin" ? "an administrator" : "a standard user"}`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not change this role");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="users"
      badge="Operations"
      title="User management"
      subtitle={`${accounts.length} accounts across customers, vendors and riders`}
      role={context.role}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="All accounts" value={directory.totals.all} hint="Registered on AVORA" icon={Users} tone="purple" />
        <StatCard label="Customers" value={directory.totals.customers} hint="Ordering accounts" icon={Users} tone="blue" />
        <StatCard label="Vendors" value={directory.totals.vendors} hint="With a store" icon={Store} tone="green" />
        <StatCard label="Riders" value={directory.totals.riders} hint="Delivery partners" icon={Bike} tone="orange" />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
            <Search className="h-4 w-4 text-[#9A8CA8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email or store"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
            />
          </span>
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                filter === entry.key ? "bg-[#2B0B4D] text-white" : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No accounts match" description="Try another search term or account type." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="bg-[#FBF8F3] text-[10.5px] uppercase tracking-[0.1em] text-[#A797B4]">
                <tr>
                  <th className="px-4 py-2.5">Account</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Details</th>
                  <th className="px-4 py-2.5 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3ECF9]">
                {visible.map((account) => {
                  const kind = accountKind(account);
                  return (
                    <tr key={account.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-[#1B1024]">{account.full_name || account.email}</p>
                        <p className="text-[11px] text-[#9A8CA8]">{account.email}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10.5px] font-bold capitalize",
                            kind === "admin" && "bg-[#F3ECFB] text-[#4B2080]",
                            kind === "vendor" && "bg-[#E7F6EC] text-[#15693F]",
                            kind === "rider" && "bg-[#FFF1E4] text-[#B05C00]",
                            kind === "customer" && "bg-[#E9EFFB] text-[#1E4A9E]"
                          )}
                        >
                          {kind}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px] text-[#5B4A6B]">
                        {account.store_name && <span className="block">Store · {account.store_name}</span>}
                        {account.rider_status && <span className="block">Rider · {account.rider_status}</span>}
                        {account.staff_role && <span className="block">Console · {account.staff_role}</span>}
                        {!account.store_name && !account.rider_status && !account.staff_role && <span className="text-[#9A8CA8]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {account.email === directory.me ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#A797B4]">
                            <ShieldCheck className="h-3.5 w-3.5" /> You
                          </span>
                        ) : (
                          <FieldSelect
                            value={account.role === "admin" ? "admin" : "user"}
                            onChange={(value) => changeRole(account, value)}
                            options={[
                              { value: "user", label: "User" },
                              { value: "admin", label: "Admin" },
                            ]}
                            ariaLabel={`Role for ${account.email}`}
                            className="mt-0 ml-auto h-9 w-[104px] rounded-lg text-[12px] font-semibold"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-3 text-[11.5px] text-[#9A8CA8]">
        Vendor and rider status is managed in Verification; console staff roles live in Staff management.
      </p>
    </ConsoleShell>
  );
}