import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import EmptyState from "@/components/avora/EmptyState";
import CategoryRow from "@/components/avora/admin/CategoryRow";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { categoryBoard, deleteCategory, reorderCategories, saveCategory } from "@/lib/platform-fns";
import { Eye, EyeOff, Plus } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-categories")({
  loader: async () => {
    const [context, board] = await Promise.all([getConsoleContext(), categoryBoard()]);
    return { context, board };
  },
  head: () => ({ meta: [{ title: "Categories · AVORA admin" }] }),
  component: AdminCategories,
});

const BLANK = { id: "", name: "", emoji: "", description: "", is_active: true };

function AdminCategories() {
  const { context, board } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveCategory);
  const drop = useServerFn(deleteCategory);
  const reorder = useServerFn(reorderCategories);
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  if (!board.admin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="categories" badge="Catalog" title="Categories" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const categories = board.categories;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          id: draft.id || undefined,
          name: draft.name,
          emoji: draft.emoji,
          description: draft.description,
          is_active: draft.is_active,
        },
      });
      toast.success(draft.id ? "Category updated" : `${draft.name} added to the directory`);
      setDraft(BLANK);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not save this category");
    } finally {
      setBusy(false);
    }
  };

  const move = async (index, step) => {
    const next = [...categories];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await reorder({ data: { ids: next.map((row) => row.id) } });
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not change the order");
    }
  };

  const remove = async (category) => {
    try {
      await drop({ data: { id: category.id } });
      toast.success(`${category.name} deleted`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not delete this category");
    }
  };

  const toggleActive = async (category) => {
    try {
      await save({
        data: {
          id: category.id,
          name: category.name,
          emoji: category.emoji,
          description: category.description,
          is_active: !(category.is_active !== false),
        },
      });
      toast.success(
        category.is_active === false ? `${category.name} is visible` : `${category.name} hidden`
      );
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this category");
    }
  };

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="categories"
      badge="Catalog"
      title="Categories"
      subtitle={`${categories.length} categories · drag order sets the store directory`}
      role={context.role}
    >
      <form onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
          <Plus className="h-4 w-4 text-[#4B2080]" /> {draft.id ? "Edit category" : "Add a category"}
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Name (Restaurants)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.emoji}
            onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
            placeholder="Emoji (🍲)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Short description"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080] sm:col-span-2"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#FF7A00] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
          >
            {busy ? "Saving…" : draft.id ? "Save changes" : "Add category"}
          </button>
          {draft.id && (
            <button
              type="button"
              onClick={() => setDraft(BLANK)}
              className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-[#5B4A6B] ring-1 ring-[#EFE7F6] transition hover:text-[#2B0B4D]"
            >
              Cancel
            </button>
          )}
          <p className="text-[11.5px] text-[#9A8CA8]">Categories appear in this order on the store directory.</p>
        </div>
      </form>

      {categories.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No categories yet"
            description="Add your first category — it becomes a filter chip customers use to browse stores."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {categories.map((category, index) => (
            <div key={category.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <CategoryRow
                  category={category}
                  index={index}
                  total={categories.length}
                  onMove={move}
                  onDelete={remove}
                  onEdit={(row) =>
                    setDraft({
                      id: row.id,
                      name: row.name ?? "",
                      emoji: row.emoji ?? "",
                      description: row.description ?? "",
                      is_active: row.is_active !== false,
                    })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => toggleActive(category)}
                aria-label={category.is_active === false ? `Show ${category.name}` : `Hide ${category.name}`}
                className="shrink-0 rounded-xl bg-white p-2 text-[#8B7A9C] ring-1 ring-[#EFE7F6] transition hover:text-[#2B0B4D]"
              >
                {category.is_active === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
}