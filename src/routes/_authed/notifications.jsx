import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { markAllNotificationsRead, markNotificationRead, notificationsFeed } from "@/lib/insight-fns";
import { timeAgo } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { BadgePercent, Bell, CheckCheck, Receipt, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authed/notifications")({
  loader: () => notificationsFeed(),
  head: () => ({ meta: [{ title: "Notifications · AVORA" }] }),
  component: NotificationsPage,
});

const TABS = [
  { key: "all", label: "All" },
  { key: "order", label: "Orders" },
  { key: "promo", label: "Offers" },
  { key: "account", label: "Account" },
];

const ICONS = { order: Receipt, promo: BadgePercent, account: ShieldAlert, system: Bell };
const TONES = { order: "bg-[#F3ECFB] text-[#4B2080]", promo: "bg-[#FFF1E4] text-[#B05C00]", account: "bg-[#E9EFFB] text-[#1E4A9E]", system: "bg-[#F2EEF7] text-[#5B4A6B]" };

function NotificationsPage() {
  const { notifications, unread } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const open = useServerFn(markNotificationRead);
  const readAll = useServerFn(markAllNotificationsRead);
  const [tab, setTab] = useState("all");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => (tab === "all" ? notifications : notifications.filter((row) => row.kind === tab)),
    [notifications, tab]
  );

  const handleOpen = async (item) => {
    if (!item.is_read) {
      try {
        await open({ data: { id: item.id } });
        await router.invalidate();
      } catch (error) {
        toast.error(error?.message || "Could not update that notification");
      }
    }
    if (item.link) {
      const [path, query] = item.link.split("?");
      navigate({ to: path, search: query ? Object.fromEntries(new URLSearchParams(query)) : {} });
    }
  };

  const handleReadAll = async () => {
    setBusy(true);
    try {
      await readAll();
      toast.success("All caught up");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not mark notifications read");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">Your updates</p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Notifications</h1>
          <p className="text-[13px] text-[#8B7A9C]">
            {unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You are all caught up."}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={handleReadAll}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#3B0A66] ring-1 ring-[#EFE7F6] transition hover:bg-[#F8F5FC] disabled:opacity-60"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              tab === entry.key ? "bg-[#2B0B4D] text-white" : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing here yet" description="Order updates, offers and account alerts land here as they happen." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[#F3ECF9] overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
          {visible.map((item) => {
            const Icon = ICONS[item.kind] ?? Bell;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#FBF8F3]",
                    !item.is_read && "bg-[#FEFBF6]"
                  )}
                >
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", TONES[item.kind] ?? TONES.system)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#1B1024]">{item.title}</span>
                      {!item.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#FF7A00]" />}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-[#8B7A9C]">{item.body}</span>
                    <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.08em] text-[#B8AAC6]">{timeAgo(item.created_date)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CustomerShell>
  );
}