import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { HELP_ARTICLES, HELP_AUDIENCES } from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { ChevronDown, Headphones, LifeBuoy, Search } from "lucide-react";

export const Route = createFileRoute("/_authed/help-center")({
  head: () => ({ meta: [{ title: "Help center · AVORA" }] }),
  component: HelpCenter,
});

function HelpCenter() {
  const [audience, setAudience] = useState("customers");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return HELP_ARTICLES.filter((article) => {
      const matchesAudience = query.trim() ? true : article.audience === audience;
      const matchesQuery =
        !term || `${article.question} ${article.answer} ${article.category}`.toLowerCase().includes(term);
      return matchesAudience && matchesQuery;
    });
  }, [audience, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const article of visible) {
      map.set(article.category, [...(map.get(article.category) ?? []), article]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Help center</h1>
      <p className="text-[13px] text-[#8B7A9C]">Answers for customers, riders and vendors — search or browse by topic.</p>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center gap-2 rounded-full bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
          <Search className="h-4 w-4 text-[#9A8CA8]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search delivery, refunds, payouts…"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HELP_AUDIENCES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setAudience(entry.key);
                setQuery("");
                setOpenId(null);
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                !query && audience === entry.key
                  ? "bg-[#2B0B4D] text-white"
                  : "bg-[#F8F5FC] text-[#5B4A6B] hover:text-[#2B0B4D]"
              )}
            >
              {entry.label}
            </button>
          ))}
          {query && (
            <span className="rounded-full bg-[#FFF1E4] px-3 py-1.5 text-[11.5px] font-semibold text-[#B05C00]">
              Searching all audiences
            </span>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No answers for that search"
            description="Try a shorter phrase, or message our support team and we will reply in the app."
            action={
              <Link to="/support" className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white">
                Contact support
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map(([category, articles]) => (
            <section key={category}>
              <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">{category}</h2>
              <ul className="mt-2 divide-y divide-[#F3ECF9] overflow-hidden rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
                {articles.map((article) => {
                  const id = `${article.audience}-${article.question}`;
                  const open = openId === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : id)}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left"
                        aria-expanded={open}
                      >
                        <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#1B1024]">{article.question}</span>
                        <ChevronDown
                          className={cn("h-4 w-4 shrink-0 text-[#A797B4] transition", open && "rotate-180 text-[#4B2080]")}
                        />
                      </button>
                      {open && (
                        <p className="px-4 pb-3 text-[12.5px] leading-relaxed text-[#5B4A6B]">{article.answer}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          to="/support"
          className="flex items-center gap-2.5 rounded-2xl bg-[#2B0B4D] p-4 text-white transition hover:bg-[#3B0A66]"
        >
          <Headphones className="h-5 w-5" />
          <span>
            <span className="block text-[13px] font-bold">Talk to a human</span>
            <span className="block text-[11.5px] text-white/70">Open a support ticket</span>
          </span>
        </Link>
        <Link
          to="/become-a-vendor"
          className="flex items-center gap-2.5 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]"
        >
          <LifeBuoy className="h-5 w-5 text-[#FF7A00]" />
          <span>
            <span className="block text-[13px] font-bold text-[#1B1024]">Selling on AVORA?</span>
            <span className="block text-[11.5px] text-[#8B7A9C]">Vendor partner guide</span>
          </span>
        </Link>
      </div>
    </CustomerShell>
  );
}