import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import ProductImageCell from "@/components/avora/console/ProductImageCell";
import EmptyState from "@/components/avora/EmptyState";
import FieldSelect from "@/components/avora/FieldSelect";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { formatNGN } from "@/lib/avora";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Package, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-inventory")({
  loader: async () => {
    const context = await getConsoleContext();
    const isAdmin = context.role === "admin";
    const [products, stores] = isAdmin
      ? await Promise.all([
          db.entities.Product.list("-created_date", 300),
          db.entities.Store.list("-created_date", 100),
        ])
      : [[], []];
    return { context, isAdmin, products, stores };
  },
  head: () => ({ meta: [{ title: "Catalog moderation · AVORA admin" }] }),
  component: AdminInventory,
});

function AdminInventory() {
  const { context, isAdmin, products, stores } = Route.useLoaderData();
  const router = useRouter();
  const [storeId, setStoreId] = useState("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesStore = storeId === "all" || product.store_id === storeId;
      const matchesQuery =
        !term || `${product.name} ${product.store_name ?? ""} ${product.category ?? ""}`.toLowerCase().includes(term);
      return matchesStore && matchesQuery;
    });
  }, [products, storeId, query]);

  if (!isAdmin) {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="inventory" badge="Operations" title="Catalog" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const toggle = async (product) => {
    try {
      await db.entities.Product.update(product.id, { is_available: product.is_available === false });
      toast.success(product.is_available === false ? `${product.name} is live again` : `${product.name} hidden from customers`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update this product");
    }
  };

  const drop = async (product) => {
    try {
      await db.entities.Product.delete(product.id);
      toast.success(`${product.name} deleted`);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not delete this product");
    }
  };

  const hidden = products.filter((product) => product.is_available === false).length;
  const catalogValue = products.reduce((sum, product) => sum + (product.price || 0) * (product.stock || 0), 0);

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="inventory"
      badge="Operations"
      title="Platform catalog"
      subtitle={`${products.length} items across ${stores.length} stores · ${hidden} hidden · ${formatNGN(catalogValue)} stock value`}
      role={context.role}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FieldSelect
          value={storeId}
          onChange={setStoreId}
          options={[
            { value: "all", label: "All stores" },
            ...stores.map((store) => ({ value: store.id, label: store.name })),
          ]}
          className="mt-0 h-9 w-[180px] rounded-full border-[#E4D9EE] bg-white text-[12.5px] font-semibold"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search item, store or category"
          className="w-full rounded-full border border-[#E4D9EE] bg-white px-3.5 py-2 text-[12.5px] outline-none focus:border-[#4B2080] sm:w-[300px]"
        />
        <span className="ml-auto text-[12px] font-semibold text-[#8B7A9C]">{visible.length} shown</span>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No items match" description="Try another store or clear the search." />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-[#EDE5F4]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#F3ECF9] text-[10.5px] uppercase tracking-[0.08em] text-[#A797B4]">
                <th className="px-4 py-2.5 font-bold">Item</th>
                <th className="hidden px-3 py-2.5 font-bold sm:table-cell">Store</th>
                <th className="px-3 py-2.5 font-bold">Price</th>
                <th className="hidden px-3 py-2.5 font-bold md:table-cell">Stock</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className="border-b border-[#F8F3FC] last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProductImageCell product={product} readOnly className="h-8 w-8 text-[15px]" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-[#1B1024]">{product.name}</p>
                        <p className="truncate text-[11px] text-[#9A8CA8]">{product.category || product.unit || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-[12px] text-[#5B4A6B] sm:table-cell">{product.store_name}</td>
                  <td className="px-3 py-2.5 text-[12.5px] font-bold text-[#2B0B4D]">{formatNGN(product.price)}</td>
                  <td className="hidden px-3 py-2.5 text-[12px] text-[#5B4A6B] md:table-cell">{product.stock ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                        product.is_available === false ? "bg-[#FDECEC] text-[#A11D1D]" : "bg-[#E7F6EC] text-[#15693F]"
                      )}
                    >
                      {product.is_available === false ? "Hidden" : "Live"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggle(product)}
                        className="text-[#8B7A9C] transition hover:text-[#2B0B4D]"
                        aria-label={product.is_available === false ? `Show ${product.name}` : `Hide ${product.name}`}
                      >
                        {product.is_available === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => drop(product)}
                        className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#9A8CA8]">
        <Package className="h-3.5 w-3.5" /> Hiding an item keeps it in the vendor's catalog but removes it from store menus.
      </p>
    </ConsoleShell>
  );
}