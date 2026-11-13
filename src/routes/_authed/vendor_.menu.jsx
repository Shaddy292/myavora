import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import EmptyState from "@/components/avora/EmptyState";
import ImageUploadField from "@/components/avora/console/ImageUploadField";
import ProductImageCell from "@/components/avora/console/ProductImageCell";
import { getConsoleContext } from "@/lib/avora-fns";
import {
  createVendorProduct,
  deleteVendorProduct,
  updateVendorProduct,
  vendorCatalogue,
} from "@/lib/vendor-fns";
import { formatNGN } from "@/lib/avora";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor_/menu")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, products: [] };
    const catalogue = await vendorCatalogue();
    return { context, products: catalogue.products };
  },
  head: () => ({ meta: [{ title: "Menu & stock · AVORA" }] }),
  component: VendorMenu,
});

const NAV = [
  { key: "board", label: "Order board", to: "/vendor" },
  { key: "menu", label: "Menu & stock", to: "/vendor/menu" },
  { key: "products", label: "Inventory", to: "/vendor-products" },
  { key: "analytics", label: "Analytics", to: "/vendor-dashboard" },
  { key: "settlements", label: "Settlements", to: "/vendor/settlements" },
];

const blank = { name: "", description: "", price: "", stock: "", unit: "1 portion", image_url: "" };

function VendorMenu() {
  const { context, products } = Route.useLoaderData();
  const router = useRouter();
  const store = context.store;
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const createProduct = useServerFn(createVendorProduct);
  const saveProduct = useServerFn(updateVendorProduct);
  const removeProduct = useServerFn(deleteVendorProduct);

  if (!store) {
    return (
      <ConsoleShell nav={NAV} active="menu" badge="Vendor console" title="Menu & stock" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createProduct({
        data: {
          name: draft.name,
          description: draft.description || undefined,
          price: Number(draft.price) || 0,
          stock: Number(draft.stock) || 0,
          unit: draft.unit || "1 portion",
          image_url: draft.image_url || undefined,
        },
      });
      setDraft(blank);
      toast.success("Product added");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not add the product");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id, changes, message) => {
    await saveProduct({ data: { id, ...changes } });
    if (message) toast.success(message);
    await router.invalidate();
  };

  const remove = async (id) => {
    await removeProduct({ data: { id } });
    toast.success("Product removed");
    await router.invalidate();
  };

  return (
    <ConsoleShell
      nav={NAV}
      active="menu"
      badge="Vendor console"
      title="Menu & stock"
      subtitle={`${products.length} items · ${store.name}`}
      role={context.role}
    >
      <form onSubmit={save} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Add a product</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Product name"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            required
            type="number"
            min="0"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="Price (₦)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="number"
            min="0"
            value={draft.stock}
            onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
            placeholder="Stock"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
        </div>
        <div className="mt-2 sm:max-w-xs">
          <ImageUploadField
            label="Product photo"
            value={draft.image_url}
            onChange={(url) => setDraft({ ...draft, image_url: url })}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#3B0A66] disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Add product"}
        </button>
      </form>

      <div className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {products.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Your menu is empty" description="Add your first product above to start selling." />
          </div>
        ) : (
          <ul className="divide-y divide-[#F3ECF9]">
            {products.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <ProductImageCell
                  product={product}
                  onUploaded={(url) => patch(product.id, { image_url: url }, "Photo updated")}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[#1B1024]">{product.name}</p>
                  <p className="text-[11.5px] text-[#9A8CA8]">{product.unit || "1 portion"}</p>
                </div>
                <input
                  type="number"
                  min="0"
                  defaultValue={product.price}
                  onBlur={(e) =>
                    Number(e.target.value) !== product.price &&
                    patch(product.id, { price: Number(e.target.value) || 0 }, "Price updated")
                  }
                  className="w-[92px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] font-semibold text-[#2B0B4D] outline-none focus:border-[#4B2080]"
                  aria-label={`Price for ${product.name}`}
                />
                <input
                  type="number"
                  min="0"
                  defaultValue={product.stock ?? 0}
                  onBlur={(e) =>
                    Number(e.target.value) !== (product.stock ?? 0) &&
                    patch(product.id, { stock: Number(e.target.value) || 0 }, "Stock updated")
                  }
                  className="w-[74px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] text-[#5B4A6B] outline-none focus:border-[#4B2080]"
                  aria-label={`Stock for ${product.name}`}
                />
                <button
                  type="button"
                  onClick={() => patch(product.id, { is_available: !product.is_available }, "Availability updated")}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    product.is_available ? "bg-[#E7F6EC] text-[#15693F]" : "bg-[#FDECEC] text-[#A11D1D]"
                  }`}
                >
                  {product.is_available ? "Available" : "Hidden"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(product.id)}
                  className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Delete ${product.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="w-full text-[11px] text-[#9A8CA8] sm:hidden">{formatNGN(product.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConsoleShell>
  );
}