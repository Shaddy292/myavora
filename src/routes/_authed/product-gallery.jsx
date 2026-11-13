import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import EmptyState from "@/components/avora/EmptyState";
import ProductImageCell from "@/components/avora/console/ProductImageCell";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authed/product-gallery")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, products: [] };
    const page = await db.entities.Product.filter(
      { store_id: context.store.id },
      { sort: "name", limit: 200 }
    );
    return { context, products: page.items ?? page };
  },
  head: () => ({ meta: [{ title: "Product gallery · AVORA" }] }),
  component: ProductGallery,
});

const FILTERS = [
  { key: "all", label: "All items" },
  { key: "missing", label: "Needs a photo" },
  { key: "with", label: "Has a photo" },
];

function ProductGallery() {
  const { context, products } = Route.useLoaderData();
  const router = useRouter();
  const store = context.store;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const missing = products.filter((product) => !product.image_url).length;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesFilter =
        filter === "all" || (filter === "missing" && !product.image_url) || (filter === "with" && !!product.image_url);
      const matchesQuery = !term || product.name.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [products, filter, query]);

  if (!store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="gallery" badge="Vendor console" title="Product gallery" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const replacePhoto = async (product, url) => {
    await db.entities.Product.update(product.id, { image_url: url });
    await router.invalidate();
  };

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="gallery"
      badge="Vendor console"
      title="Product gallery"
      subtitle={`${products.length} items · ${missing} without a photo`}
      role={context.role}
    >
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-bold transition",
              filter === item.key
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            )}
          >
            {item.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-[#EFE7F6]">
          <Search className="h-3.5 w-3.5 text-[#B5A7C2]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an item"
            className="w-32 bg-transparent text-[12.5px] outline-none placeholder:text-[#B5A7C2]"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nothing to show"
            description={products.length === 0 ? "Add items to your menu first — their photos land here." : "No items match that filter."}
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((product) => (
            <div key={product.id} className="rounded-2xl bg-white p-2.5 ring-1 ring-[#EFE7F6]">
              <ProductImageCell
                product={product}
                className="h-[120px] w-full rounded-xl text-[38px]"
                onUploaded={(url) => replacePhoto(product, url)}
              />
              <p className="mt-2 truncate text-[12.5px] font-semibold text-[#1B1024]">{product.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-[#2B0B4D]">{formatNGN(product.price)}</span>
                <span className={cn("text-[10.5px] font-bold", product.image_url ? "text-[#1F7A4C]" : "text-[#B05C00]")}>
                  {product.image_url ? "Photo" : "Missing"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] text-[#A797B4]">
        Tap any photo to replace it from your device. Changes save instantly.
      </p>
    </ConsoleShell>
  );
}