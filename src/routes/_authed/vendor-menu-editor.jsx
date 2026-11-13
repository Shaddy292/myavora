import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StatCard from "@/components/avora/StatCard";
import EmptyState from "@/components/avora/EmptyState";
import ProductImageCell from "@/components/avora/console/ProductImageCell";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, PackageX, Search, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-menu-editor")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, products: [] };
    const page = await db.entities.Product.filter(
      { store_id: context.store.id },
      { sort: "name", limit: 200 }
    );
    return { context, products: page.items ?? page };
  },
  head: () => ({ meta: [{ title: "Menu editor · AVORA vendor" }] }),
  component: VendorMenuEditor,
});

const FILTERS = [
  { key: "all", label: "All items" },
  { key: "live", label: "Live" },
  { key: "hidden", label: "Hidden" },
  { key: "soldout", label: "Out of stock" },
];

function VendorMenuEditor() {
  const { context, products } = Route.useLoaderData();
  const router = useRouter();
  const store = context.store;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const soldOut = (product.stock ?? 0) === 0;
      const matchesFilter =
        filter === "all" ||
        (filter === "live" && product.is_available !== false) ||
        (filter === "hidden" && product.is_available === false) ||
        (filter === "soldout" && soldOut);
      const matchesQuery = !term || `${product.name} ${product.category ?? ""}`.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [products, filter, query]);

  if (!store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="menuEditor" badge="Vendor console" title="Menu editor" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const soldOut = products.filter((product) => (product.stock ?? 0) === 0);
  const hidden = products.filter((product) => product.is_available === false);
  const averagePrice = products.length
    ? Math.round(products.reduce((sum, product) => sum + (product.price || 0), 0) / products.length)
    : 0;

  const patch = async (product, changes, message) => {
    try {
      await db.entities.Product.update(product.id, changes);
      if (message) toast.success(message);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this item");
    }
  };

  const hideSoldOut = async () => {
    const targets = soldOut.filter((product) => product.is_available !== false);
    if (!targets.length) {
      toast("Every sold-out item is already hidden");
      return;
    }
    setBusy(true);
    try {
      await db.entities.Product.bulkUpdate(
        targets.map((product) => ({ id: product.id, is_available: false }))
      );
      toast.success(`${targets.length} sold-out items hidden`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not hide those items");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="menuEditor"
      badge="Vendor console"
      title="Menu editor"
      subtitle={`${store.name} · ${products.length} items on the menu`}
      role={context.role}
      actions={
        <button
          type="button"
          onClick={hideSoldOut}
          disabled={busy}
          className="rounded-full bg-[#2B0B4D] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
        >
          {busy ? "Hiding…" : "Hide sold-out"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On the menu" value={products.length} hint="Total items" icon={SlidersHorizontal} tone="purple" />
        <StatCard label="Live" value={products.length - hidden.length} hint="Visible to customers" icon={Eye} tone="green" />
        <StatCard label="Hidden" value={hidden.length} hint="Paused items" icon={EyeOff} tone="blue" />
        <StatCard label="Out of stock" value={soldOut.length} hint={`Avg price ${formatNGN(averagePrice)}`} icon={PackageX} tone="orange" />
      </div>

      <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
            <Search className="h-4 w-4 text-[#9A8CA8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the menu"
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

      <section className="mt-3 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No items match" description="Adjust the filters or add items from your inventory page." />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {visible.map((product) => {
              const isLive = product.is_available !== false;
              const stock = product.stock ?? 0;
              return (
                <li key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ProductImageCell
                    product={product}
                    onUploaded={(url) => patch(product, { image_url: url }, "Photo updated")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#1B1024]">{product.name}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">
                      {product.category || "Uncategorised"} · {product.unit || "1 portion"}
                    </p>
                  </div>

                  <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">
                    Price
                    <input
                      type="number"
                      min="0"
                      defaultValue={product.price}
                      onBlur={(event) =>
                        Number(event.target.value) !== product.price &&
                        patch(product, { price: Number(event.target.value) || 0 }, "Price updated")
                      }
                      className="w-[92px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] font-semibold normal-case tracking-normal text-[#2B0B4D] outline-none focus:border-[#4B2080]"
                      aria-label={`Price for ${product.name}`}
                    />
                  </label>

                  <label className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">
                    Stock
                    <input
                      type="number"
                      min="0"
                      defaultValue={stock}
                      onBlur={(event) =>
                        Number(event.target.value) !== stock &&
                        patch(product, { stock: Number(event.target.value) || 0 }, "Stock updated")
                      }
                      className="w-[76px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] normal-case tracking-normal text-[#5B4A6B] outline-none focus:border-[#4B2080]"
                      aria-label={`Stock for ${product.name}`}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      patch(
                        product,
                        { is_available: !isLive },
                        isLive ? `${product.name} hidden from the menu` : `${product.name} is live again`
                      )
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition",
                      isLive ? "bg-[#E7F6EC] text-[#15693F] hover:bg-[#D8F0E1]" : "bg-[#FDECEC] text-[#A11D1D] hover:bg-[#F9DCDC]"
                    )}
                  >
                    {isLive ? "Live" : "Hidden"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-3 text-[11.5px] text-[#9A8CA8]">
        Prices and stock save when you leave the field. Hidden items stay on your inventory but customers can't order them.
      </p>
    </ConsoleShell>
  );
}