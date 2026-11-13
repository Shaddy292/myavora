import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { useAuth } from "@/lib/AuthContext";
import { closeTicket, getConsoleContext, replyTicket, supportQueue } from "@/lib/avora-fns";
import { formatDateTime } from "@/lib/avora";
import { Headphones, Send } from "lucide-react";

const TOPICS = [
  "Order problem",
  "Missing or wrong item",
  "Refund request",
  "Rider issue",
  "Account & payments",
].map((topic) => ({ value: topic, label: topic }));

export const Route = createFileRoute("/_authed/support")({
  loader: async () => {
    const context = await getConsoleContext();
    const mine = await db.entities.SupportTicket.list("-created_date", 30);
    const isStaff = ["admin", "support"].includes(context.role);
    const queue = isStaff ? await supportQueue() : [];
    return { context, mine, queue, isStaff };
  },
  head: () => ({ meta: [{ title: "Support · AVORA" }] }),
  component: SupportPage,
});

function SupportPage() {
  const { context, mine, queue, isStaff } = Route.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const reply = useServerFn(replyTicket);
  const close = useServerFn(closeTicket);
  const [draft, setDraft] = useState({ topic: "Order problem", message: "", order_code: "" });
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);

  const tickets = isStaff ? queue : mine;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.entities.SupportTicket.create({
        ...draft,
        customer_email: user.email,
        customer_name: user.full_name || user.email,
        status: "open",
        messages: [
          {
            from: user.full_name || user.email,
            body: draft.message,
            at: new Date().toISOString(),
          },
        ],
      });
      setDraft({ topic: "Order problem", message: "", order_code: "" });
      toast.success("Ticket sent — support will reply shortly");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not send your message");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (ticketId) => {
    const body = (replies[ticketId] || "").trim();
    if (!body) return;
    try {
      await reply({ data: { ticket_id: ticketId, body } });
      setReplies({ ...replies, [ticketId]: "" });
      toast.success("Reply sent");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not send the reply");
    }
  };

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">Help centre</p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Support</h1>
          <p className="text-[13px] text-[#8B7A9C]">
            {isStaff ? "Agent view — every customer conversation in one queue." : "Missing items, late orders, refunds — tell us what happened."}
          </p>
        </div>
        {context.permissions.includes("support.manage") && (
          <span className="rounded-full bg-[#2B0B4D] px-3 py-1.5 text-[11.5px] font-bold text-white">
            Support agent
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        {!isStaff && (
          <form onSubmit={submit} className="h-fit rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
              <Headphones className="h-4 w-4 text-[#4B2080]" /> New request
            </h2>
            <div className="mt-3 space-y-2">
              <FieldSelect
                value={draft.topic}
                onChange={(value) => setDraft({ ...draft, topic: value })}
                options={TOPICS}
                className="mt-0"
              />
              <input
                value={draft.order_code}
                onChange={(e) => setDraft({ ...draft, order_code: e.target.value })}
                placeholder="Order code (optional, e.g. AV-4821)"
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
              <textarea
                required
                rows={5}
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                placeholder="What happened?"
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-[#FF7A00] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send request"}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {tickets.length === 0 ? (
            <EmptyState
              title={isStaff ? "Queue is clear" : "No tickets yet"}
              description={
                isStaff
                  ? "New customer conversations will appear here."
                  : "When something goes wrong with an order, open a request and we'll answer right away."
              }
            />
          ) : (
            tickets.map((ticket) => (
              <article key={ticket.id} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-[14px] font-bold text-[#1B1024]">{ticket.topic}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">
                      {ticket.customer_email}
                      {ticket.order_code ? ` · ${ticket.order_code}` : ""} · {formatDateTime(ticket.created_date)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                      ticket.status === "closed"
                        ? "bg-[#F2EEF7] text-[#5B4A6B]"
                        : ticket.status === "answered"
                          ? "bg-[#E7F6EC] text-[#15693F]"
                          : "bg-[#FFF4E3] text-[#A95400]"
                    }`}
                  >
                    {ticket.status}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5">
                  {(ticket.messages?.length ? ticket.messages : [{ from: ticket.customer_name, body: ticket.message }]).map(
                    (message, i) => (
                      <p
                        key={`${ticket.id}-${i}`}
                        className={`rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                          message.from === "AVORA Support"
                            ? "bg-[#F3ECFB] text-[#3B0A66]"
                            : "bg-[#FBF8F3] text-[#5B4A6B]"
                        }`}
                      >
                        <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">
                          {message.from}
                        </span>
                        {message.body}
                      </p>
                    )
                  )}
                </div>

                {ticket.status !== "closed" && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={replies[ticket.id] || ""}
                      onChange={(e) => setReplies({ ...replies, [ticket.id]: e.target.value })}
                      placeholder="Write a reply…"
                      className="min-w-0 flex-1 rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
                    />
                    <button
                      type="button"
                      onClick={() => sendReply(ticket.id)}
                      className="flex items-center gap-1 rounded-xl bg-[#2B0B4D] px-3 py-2 text-[12px] font-bold text-white"
                    >
                      <Send className="h-3.5 w-3.5" /> Send
                    </button>
                    {isStaff && (
                      <button
                        type="button"
                        onClick={async () => {
                          await close({ data: { ticket_id: ticket.id } });
                          toast.success("Ticket closed");
                          await router.invalidate();
                        }}
                        className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6]"
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </CustomerShell>
  );
}