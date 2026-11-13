import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { getConsoleContext } from "@/lib/avora-fns";
import { replyTicket } from "@/lib/avora-fns";
import { HELP_ARTICLES } from "@/lib/help-content";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { ChevronDown, MessageSquare, Search, Send } from "lucide-react";

export const Route = createFileRoute("/_authed/support-center")({
  loader: async () => {
    const context = await getConsoleContext();
    const tickets = await db.entities.SupportTicket.filter(
      { customer_email: context.user.email },
      { sort: "-created_date", limit: 30 }
    );
    return { context, tickets: Array.isArray(tickets) ? tickets : tickets.items ?? [] };
  },
  head: () => ({ meta: [{ title: "Support center · AVORA" }] }),
  component: SupportCenter,
});

const TOPICS = ["Order problem", "Missing or wrong item", "Refund request", "Rider issue", "Account & payments"];
const STATUS_TONE = {
  open: "bg-[#FFF4E3] text-[#A95400]",
  answered: "bg-[#E7F6EC] text-[#15693F]",
  closed: "bg-[#F2EEF7] text-[#5B4A6B]",
};

function SupportCenter() {
  const { context, tickets } = Route.useLoaderData();
  const router = useRouter();
  const reply = useServerFn(replyTicket);
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ topic: TOPICS[0], order_code: "", message: "" });
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);

  const faqs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return HELP_ARTICLES.filter(
      (article) =>
        article.audience === "customers" &&
        (!term || `${article.question} ${article.answer} ${article.category}`.toLowerCase().includes(term))
    );
  }, [query]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.entities.SupportTicket.create({
        ...form,
        customer_email: context.user.email,
        customer_name: context.user.full_name || context.user.email,
        status: "open",
        messages: [{ from: context.user.full_name || context.user.email, body: form.message, at: new Date().toISOString() }],
      });
      setForm({ topic: TOPICS[0], order_code: "", message: "" });
      toast.success("Request opened — support replies in the app");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not open your request");
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

  const active = tickets.filter((ticket) => ticket.status !== "closed");
  const closed = tickets.filter((ticket) => ticket.status === "closed");

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">We are here to help</p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Support center</h1>
          <p className="text-[13px] text-[#8B7A9C]">Browse answers, follow your requests, or open a new ticket.</p>
        </div>
        <Link
          to="/help-center"
          className="rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#3B0A66] ring-1 ring-[#EFE7F6] transition hover:bg-[#F8F5FC]"
        >
          All help topics
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
            <MessageSquare className="h-4 w-4 text-[#4B2080]" /> Open a new ticket
          </h2>
          <div className="mt-3 space-y-2">
            <FieldSelect
              value={form.topic}
              onChange={(value) => setForm({ ...form, topic: value })}
              options={TOPICS.map((topic) => ({ value: topic, label: topic }))}
              className={INPUT}
            />
            <input
              value={form.order_code}
              onChange={(event) => setForm({ ...form, order_code: event.target.value })}
              placeholder="Order code (optional, e.g. AV-4821)"
              className={INPUT}
            />
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder="Tell us what happened…"
              className={INPUT}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-[#FF7A00] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
          >
            {busy ? "Opening…" : "Send to support"}
          </button>
        </form>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Your requests</h2>
          {tickets.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No requests yet" description="Anything that goes wrong with an order can be raised here." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...active, ...closed].map((ticket) => (
                <li key={ticket.id} className="rounded-xl bg-[#FBF8F3] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-[#1B1024]">{ticket.topic}</p>
                      <p className="text-[11px] text-[#9A8CA8]">
                        {ticket.order_code ? `${ticket.order_code} · ` : ""}
                        {formatDateTime(ticket.created_date)}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_TONE[ticket.status])}>
                      {ticket.status}
                    </span>
                  </div>
                  {(ticket.messages?.length ? ticket.messages : [{ body: ticket.message, from: ticket.customer_name }]).map(
                    (message, index) => (
                      <p
                        key={`${ticket.id}-${index}`}
                        className={cn(
                          "mt-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed",
                          message.from === "AVORA Support" ? "bg-[#F3ECFB] text-[#3B0A66]" : "bg-white text-[#5B4A6B]"
                        )}
                      >
                        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">{message.from}</span>
                        {message.body}
                      </p>
                    )
                  )}
                  {ticket.status !== "closed" && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={replies[ticket.id] || ""}
                        onChange={(event) => setReplies({ ...replies, [ticket.id]: event.target.value })}
                        placeholder="Add a reply…"
                        className={cn(INPUT, "bg-white")}
                      />
                      <button
                        type="button"
                        onClick={() => sendReply(ticket.id)}
                        className="flex items-center gap-1 rounded-xl bg-[#2B0B4D] px-3 py-2 text-[12px] font-bold text-white"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Frequently asked</h2>
          <div className="flex items-center gap-2 rounded-full bg-[#FBF8F3] px-3 py-1.5 ring-1 ring-[#F1E9F7]">
            <Search className="h-3.5 w-3.5 text-[#9A8CA8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search FAQs"
              className="w-40 bg-transparent text-[12px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
            />
          </div>
        </div>
        {faqs.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-[#8B7A9C]">No matching answers — open a ticket above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#F3ECF9] overflow-hidden rounded-xl ring-1 ring-[#F1E9F7]">
            {faqs.map((article) => {
              const open = openFaq === article.question;
              return (
                <li key={article.question}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : article.question)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    aria-expanded={open}
                  >
                    <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-[#1B1024]">{article.question}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#A797B4] transition", open && "rotate-180 text-[#4B2080]")} />
                  </button>
                  {open && <p className="px-3 pb-2.5 text-[12px] leading-relaxed text-[#5B4A6B]">{article.answer}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </CustomerShell>
  );
}

const INPUT =
  "w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[12.5px] text-[#1B1024] outline-none focus:border-[#4B2080]";