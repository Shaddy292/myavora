import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import CampaignBanners from "@/components/avora/admin/CampaignBanners";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { getSiteContent, saveSiteContent } from "@/lib/insight-fns";
import FieldSelect from "@/components/avora/FieldSelect";
import { CATEGORIES } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Megaphone, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-content")({
  loader: async () => {
    const context = await getConsoleContext();
    const content = context.role === "admin" ? await getSiteContent() : null;
    return { context, content };
  },
  head: () => ({ meta: [{ title: "Content manager · AVORA admin" }] }),
  component: AdminContent,
});

const TONES = [
  { key: "purple", label: "Purple" },
  { key: "orange", label: "Orange" },
  { key: "green", label: "Green" },
];

function AdminContent() {
  const { context, content } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveSiteContent);
  const [form, setForm] = useState(() => ({
    announcement_title: content?.announcement_title ?? "",
    announcement_body: content?.announcement_body ?? "",
    announcement_tone: content?.announcement_tone ?? "purple",
    announcement_active: content?.announcement_active ?? false,
    banners: content?.banners ?? [],
    featured_categories: content?.featured_categories?.length ? content.featured_categories : CATEGORIES,
  }));
  const [busy, setBusy] = useState(false);

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="content" badge="Operations" title="Content manager" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const moveCategory = (index, direction) =>
    setForm((current) => {
      const next = [...current.featured_categories];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, featured_categories: next };
    });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Homepage content published");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save your content");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="content"
      badge="Operations"
      title="Content manager"
      subtitle="Announcements, promo banners and homepage categories"
      role={context.role}
    >
      <form onSubmit={submit} className="space-y-4">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
              <Megaphone className="h-4 w-4 text-[#4B2080]" /> App-wide announcement
            </h2>
            <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[#5B4A6B]">
              <input
                type="checkbox"
                checked={form.announcement_active}
                onChange={(event) => setForm({ ...form, announcement_active: event.target.checked })}
                className="h-4 w-4 rounded border-[#E4D9EE]"
              />
              Show on homepage
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px]">
            <input
              value={form.announcement_title}
              onChange={(event) => setForm({ ...form, announcement_title: event.target.value })}
              placeholder="Title — e.g. Free delivery all weekend"
              className={INPUT}
            />
            <FieldSelect
              value={form.announcement_tone}
              onChange={(value) => setForm({ ...form, announcement_tone: value })}
              options={TONES.map((tone) => ({ value: tone.key, label: tone.label }))}
              className={INPUT}
            />
          </div>
          <textarea
            rows={2}
            value={form.announcement_body}
            onChange={(event) => setForm({ ...form, announcement_body: event.target.value })}
            placeholder="Short message shown under the title"
            className={cn(INPUT, "mt-2 w-full")}
          />
        </section>

        <CampaignBanners banners={form.banners} onChange={(banners) => setForm({ ...form, banners })} />

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Homepage featured categories</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">Reorder what customers see first on the home page.</p>
          <ul className="mt-3 space-y-2">
            {form.featured_categories.map((category, index) => (
              <li key={`${category.label}-${index}`} className="flex items-center gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2">
                <span className="w-7 text-center text-[16px]">{category.emoji}</span>
                <input
                  value={category.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      featured_categories: current.featured_categories.map((row, i) =>
                        i === index ? { ...row, label: event.target.value } : row
                      ),
                    }))
                  }
                  className={cn(INPUT, "min-w-0 flex-1 bg-white")}
                />
                <button type="button" onClick={() => moveCategory(index, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4]" aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveCategory(index, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4]" aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, featured_categories: form.featured_categories.filter((_, i) => i !== index) })}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#A11D1D] ring-1 ring-[#EDE5F4]"
                  aria-label="Remove category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                featured_categories: [...form.featured_categories, { label: "New category", emoji: "✨", tint: "bg-[#F8F5FC]" }],
              })
            }
            className="mt-2 flex items-center gap-1 rounded-xl bg-[#F4EEFA] px-3 py-2 text-[12px] font-bold text-[#3B0A66]"
          >
            <Plus className="h-3.5 w-3.5" /> Add category
          </button>
        </section>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#2B0B4D] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {busy ? "Publishing…" : "Publish homepage content"}
        </button>
      </form>
    </ConsoleShell>
  );
}

const INPUT =
  "mt-0 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] text-[#1B1024] outline-none focus:border-[#4B2080]";