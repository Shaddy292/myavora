import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import { SUPPORT_NAV } from "@/lib/console-nav";
import { getConsoleContext, setTicketState, supportTicketBoard } from "@/lib/avora-fns";
import { ORDER_STATUS, formatDateTime, formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Inbox, Send, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authed/support-tickets")({
  loader: async () => {
    const context = await getConsoleContext();
    const isStaff = context.permissions.includes("support.manage");
    const board = isStaff ? await supportTicketBoard() : null;
    return { context, isStaff, board };
  },
  head: () => ({ meta: [{ title: "Support tickets · AVORA" }] }),
  component: SupportTickets,
});

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "answered", label: "Answered" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const STATUS_STYLE = {
  open: "bg-[#FFF4E3] text-[#A95400]",
  answered: "bg-[#E7F6EC] text-[#15693F]",
  closed: "bg-[#F2EEF7] text-[#5B4A6B]",
};

function SupportTickets() {
  const { context, isStaff, board } = Route.useLoaderData();
  const router = useRouter();
  const update = useServerFn(setTicketState);
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isStaff) {
    return (
      <ConsoleShell nav={SUPPORT_NAV} active="queue" badge="Support" title="Support tickets" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const tickets = board.tickets;
  const visible = filter === "all" ? tickets : tickets.filter((ticket) => ticket.status === filter);
  const selected = visible.find((ticket) => ticket.id === selectedId) ?? visible[0] ?? null;
  const order = selected?.order_code
    ? board.orders.find((row) => row.code === selected.order_code)
    : null;
  const openCount = tickets.filter((ticket) => ticket.status === "open").length;

  const act = async (patch, message) => {
    if (!selected) return;
    setBusy(true);
    try {
      await update({ data: { ticket_id: selected.id, ...patch } });
      if (message) toast.success(message);
      setReply("");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the ticket");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={SUPPORT_NAV}
      active="queue"
      badge="Support"
      title="Ticket queue"
      subtitle={`${openCount} open · ${tickets.length} total`}
      role={context.role}
    >
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition",
              filter === entry.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4] hover:text-[#2B0B4D]"
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing in this queue" description="Customer conversations appear here as soon as they are opened." />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {visible.map((ticket) => (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={cn(
                    "w-full rounded-2xl p-3 text-left transition",
                    selected?.id === ticket.id
                      ? "bg-white ring-2 ring-[#4B2080]"
                      : "bg-white ring-1 ring-[#EDE5F4] hover:ring-[#D9C6EA]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] font-bold text-[#1B1024]">{ticket.topic}</p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_STYLE[ticket.status])}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-[#8B7A9C]">{ticket.customer_email}</p>
                  <p className="text-[11px] text-[#A797B4]">
                    {ticket.order_code ? `${ticket.order_code} · ` : ""}
                    {formatDateTime(ticket.created_date)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="space-y-3">
              <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EDE5F4]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[16px] font-bold text-[#1B1024]">{selected.topic}</h2>
                    <p className="text-[12px] text-[#8B7A9C]">
                      {selected.customer_name || selected.customer_email} · {selected.customer_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F8F5FC] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#5B4A6B]">
                      {selected.priority}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act({ assigned_to: context.user.email }, "Assigned to you")}
                      className="flex items-center gap-1 rounded-full bg-[#F4EEFA] px-2.5 py-1 text-[11px] font-bold text-[#3B0A66] transition hover:bg-[#EADFF5] disabled:opacity-60"
                    >
                      <UserCheck className="h-3 w-3" /> {selected.assigned_to ? "Reassign to me" : "Assign to me"}
                    </button>
                  </div>
                </div>
                {selected.assigned_to && (
                  <p className="mt-1 text-[11px] text-[#9A8CA8]">Owner · {selected.assigned_to}</p>
                )}

                <div className="mt-3 space-y-2">
                  {(selected.messages?.length
                    ? selected.messages
                    : [{ from: selected.customer_name || selected.customer_email, body: selected.message, at: selected.created_date }]
                  ).map((message, index) => (
                    <div
                      key={`${selected.id}-${index}`}
                      className={cn(
                        "rounded-xl px-3 py-2 text-[12.5px] leading-relaxed",
                        message.from === "AVORA Support" ? "bg-[#F3ECFB] text-[#3B0A66]" : "bg-[#FBF8F3] text-[#5B4A6B]"
                      )}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">
                        {message.from}
                        {message.at ? ` · ${formatDateTime(message.at)}` : ""}
                      </span>
                      {message.body}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Reply to the customer…"
                    className="min-w-0 flex-1 rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
                  />
                  <button
                    type="button"
                    disabled={busy || !reply.trim()}
                    onClick={() => act({ note: reply, status: "answered" }, "Reply sent")}
                    className="flex items-center gap-1 rounded-xl bg-[#2B0B4D] px-3.5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F3ECF9] pt-3">
                  {["open", "answered", "closed"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={busy || selected.status === status}
                      onClick={() => act({ status }, `Ticket marked ${status}`)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[11.5px] font-bold capitalize transition",
                        selected.status === status
                          ? "bg-[#2B0B4D] text-white"
                          : "bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4] hover:text-[#2B0B4D]"
                      )}
                    >
                      Mark {status}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EDE5F4]">
                <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
                  <Inbox className="h-4 w-4 text-[#4B2080]" /> Related order
                </h2>
                {!selected.order_code ? (
                  <p className="mt-2 text-[12.5px] text-[#8B7A9C]">No order code was attached to this ticket.</p>
                ) : !order ? (
                  <p className="mt-2 text-[12.5px] text-[#8B7A9C]">
                    We could not find order {selected.order_code} — it may have been deleted.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 text-[12.5px] text-[#5B4A6B]">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[#1B1024]">{order.code}</strong>
                      <span className="rounded-full bg-[#F8F5FC] px-2 py-0.5 text-[10.5px] font-bold text-[#5B4A6B]">
                        {ORDER_STATUS[order.status]?.label ?? order.status}
                      </span>
                      <span className="text-[#8B7A9C]">{formatDateTime(order.created_date)}</span>
                    </div>
                    <p>
                      {order.store_name} → {order.address_line}
                      {order.address_area ? `, ${order.address_area}` : ""}
                    </p>
                    <ul className="rounded-xl bg-[#FBF8F3] px-3 py-2">
                      {(order.items ?? []).map((item, index) => (
                        <li key={`${item.product_id}-${index}`} className="flex justify-between py-0.5">
                          <span>
                            {item.qty}× {item.name}
                          </span>
                          <span className="font-semibold text-[#2B0B4D]">{formatNGN((item.unit_price || 0) * (item.qty || 0))}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[#2B0B4D]">
                      <span>Total {formatNGN(order.total)}</span>
                      <span className="font-normal text-[#8B7A9C]">
                        {order.payment_method === "cash" ? "Cash" : "Card"} · {String(order.payment_status).replace(/_/g, " ")}
                      </span>
                      {order.rider_name && <span className="font-normal text-[#8B7A9C]">Rider · {order.rider_name}</span>}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </ConsoleShell>
  );
}