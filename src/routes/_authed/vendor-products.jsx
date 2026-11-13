import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import EmptyState from "@/components/avora/EmptyState";
import ImageUploadField from "@/components/avora/console/ImageUploadField";
import ProductImageCell from "@/components/avora/console/ProductImageCell";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import {
  createVendorProduct,
  deleteVendorProduct,
  updateVendorProduct,
  vendorCatalogue,
} from "@/lib/vendor-fns";
import { formatNGN } from "@/lib/avora";
import { Package, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/vendor-products")({
  loader: async () => {
    const context = await getConsoleContext();
    if (!context.store) return { context, products: [] };
    const catalogue = await vendorCatalogue();
    return { context, products: catalogue.products };
  },
  head: () => ({ meta: [{ title: "Inventory · AVORA vendor" }] }),
  component: VendorProducts,
});

const BLANK = { name: "", price: "", stock: "", unit: "1 portion", category: "", image_url: "" };

function VendorProducts() {
  const { context, products } = Route.useLoaderData();
  const router = useRouter();
  const store = context.store;
  const [draft, setDraft] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const createProduct = useServerFn(createVendorProduct);
  const saveProduct = useServerFn(updateVendorProduct);
  const removeProduct = useServerFn(deleteVendorProduct);

  if (!store) {
    return (
      <ConsoleShell nav={VENDOR_NAV} active="products" badge="Vendor console" title="Inventory" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      </ConsoleShell>
    );
  }

  const patch = async (id, changes, message) => {
    try {
      await saveProduct({ data: { id, ...changes } });
      if (message) toast.success(message);
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not update the product");
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createProduct({
        data: {
          name: draft.name,
          price: Number(draft.price) || 0,
          stock: Number(draft.stock) || 0,
          unit: draft.unit || "1 portion",
          category: draft.category || undefined,
          emoji: draft.emoji || undefined,
          image_url: draft.image_url || undefined,
        },
      });
      setDraft(BLANK);
      toast.success("Item added to your inventory");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not add the product");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await removeProduct({ data: { id } });
      toast.success("Product deleted");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not delete the product");
    }
  };

  const outOfStock = products.filter((product) => (product.stock ?? 0) === 0).length;
  const hidden = products.filter((product) => product.is_available === false).length;

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="products"
      badge="Vendor console"
      title="Inventory"
      subtitle={`${products.length} items · ${outOfStock} out of stock · ${hidden} hidden`}
      role={context.role}
    >
      <form onSubmit={create} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-[#1B1024]">
          <Package className="h-4 w-4 text-[#4B2080]" /> Add a new item
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Item name"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            required
            type="number"
            min="0"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            placeholder="Price (₦)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            type="number"
            min="0"
            value={draft.stock}
            onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
            placeholder="Stock quantity"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.unit}
            onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
            placeholder="Unit (1 plate, 500 g)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            placeholder="Category (Mains, Drinks)"
            className="rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
          />
          <input
            value={draft.emoji}
            onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
            placeholder="Emoji"
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
          <Plus className="h-3.5 w-3.5" /> {busy ? "Saving…" : "Add item"}
        </button>
      </form>

      <div className="mt-4 rounded-2xl bg-white ring-1 ring-[#EFE7F6]">
        {products.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No items yet" description="Add your first product above and it appears in your store menu." />
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
                  <p className="text-[11.5px] text-[#9A8CA8]">
                    {product.unit || "1 portion"}
                    {product.category ? ` · ${product.category}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#A797B4]">₦</span>
                  <input
                    type="number"
                    min="0"
                    defaultValue={product.price}
                    onBlur={(event) =>
                      Number(event.target.value) !== product.price &&
                      patch(product.id, { price: Number(event.target.value) || 0 }, "Price updated")
                    }
                    className="w-[92px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] font-semibold text-[#2B0B4D] outline-none focus:border-[#4B2080]"
                    aria-label={`Price for ${product.name}`}
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  defaultValue={product.stock ?? 0}
                  onBlur={(event) =>
                    Number(event.target.value) !== (product.stock ?? 0) &&
                    patch(product.id, { stock: Number(event.target.value) || 0 }, "Stock updated")
                  }
                  className="w-[80px] rounded-lg border border-[#E4D9EE] px-2 py-1.5 text-[12.5px] text-[#5B4A6B] outline-none focus:border-[#4B2080]"
                  aria-label={`Stock for ${product.name}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    patch(
                      product.id,
                      { is_available: product.is_available === false },
                      product.is_available === false ? "Item is live" : "Item hidden"
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    product.is_available === false
                      ? "bg-[#FDECEC] text-[#A11D1D]"
                      : "bg-[#E7F6EC] text-[#15693F]"
                  }`}
                >
                  {product.is_available === false ? "Hidden" : "Live"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(product.id)}
                  className="text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Delete ${product.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <span className="w-full text-[11px] text-[#9A8CA8] sm:hidden">
                  {formatNGN(product.price)} · stock {product.stock ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConsoleShell>
  );
}