import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { Image } from "@/components/ui/image";
import { formatNGN } from "@/lib/avora";
import { addToCart, clearCart, useCart } from "@/lib/cart";
import { Bike, Clock, Heart, Plus, Search, ShoppingBag, Star } from "lucide-react";

export const Route = createFileRoute("/_authed/store-menu")({
  validateSearch: (search) => ({ store: search.store || undefined }),
  loaderDeps: ({ search }) => ({ store: search.store }),
  loader: async ({ deps }) => {
    const storePage = await db.entities.Store.filter({ is_approved: true }, { sort: "name", limit: 50 });
    const stores = storePage.items ?? storePage;
    const store = stores.find((row) => row.id === deps.store) ?? stores[0] ?? null;
    let products = [];
    if (store) {
      const productPage = await db.entities.Product.filter(
        { store_id: store.id },
        { sort: "name", limit: 100 }
      );
      products = productPage.items ?? productPage;
    }
    const favorites = await db.entities.Favorite.list("-created_date", 100);
    return { stores, store, products, favorites };
  },
  head: () => ({ meta: [{ title: "Store menu · AVORA" }] }),
  component: StoreMenu,
});

function StoreMenu() {
  const { stores, store, products, favorites } = Route.useLoaderData();
  const cart = useCart();
  const [query, setQuery] = useState("");
  const [favs, setFavs] = useState(favorites);
  const [busyFav, setBusyFav] = useState(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter(
      (product) => !term || `${product.name} ${product.category ?? ""}`.toLowerCase().includes(term)
    );
  }, [products, query]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const product of visible) {
      const key = product.category || "Menu";
      map.set(key, [...(map.get(key) ?? []), product]);
    }
    return [...map.entries()];
  }, [visible]);

  const add = (product) => {
    if (!store) return;
    if (cart.store && cart.store.id !== store.id) {
      clearCart();
      toast(`Started a fresh basket from ${store.name}`);
    }
    addToCart({
      product_id: product.id,
      name: product.name,
      price: product.price || 0,
      emoji: product.emoji || "🍽️",
      tint: product.tint || "bg-[#F6EEFB]",
      unit: product.unit || "",
      store_id: store.id,
      store_name: store.name,
      delivery_fee: store.delivery_fee || 0,
    });
  };

  const toggleFav = async (product) => {
    const existing = favs.find((row) => row.product_id === product.id);
    setBusyFav(product.id);
    try {
      if (existing) {
        await db.entities.Favorite.delete(existing.id);
        setFavs(favs.filter((row) => row.product_id !== product.id));
      } else {
        const created = await db.entities.Favorite.create({
          product_id: product.id,
          name: product.name,
          price: product.price || 0,
          emoji: product.emoji || "🍽️",
          tint: product.tint || "bg-[#F6EEFB]",
          unit: product.unit || "",
          store_id: store.id,
          store_name: store.name,
        });
        setFavs([...favs, created]);
        toast.success(`${product.name} saved to favorites`);
      }
    } catch (error) {
      toast.error(error?.message || "Could not update favorites");
    } finally {
      setBusyFav(null);
    }
  };

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">Store menu</p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">
            {store ? store.name : "Browse a store"}
          </h1>
          <p className="text-[13px] text-[#8B7A9C]">Pick your items and we deliver them anywhere across Nigeria.</p>
        </div>
        <Link
          to="/favorites"
          className="rounded-full bg-white px-4 py-2.5 text-[12.5px] font-bold text-[#3B0A66] ring-1 ring-[#EFE7F6] transition hover:ring-[#D9C6EA]"
        >
          My favorites
        </Link>
      </div>

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stores.map((row) => (
          <Link
            key={row.id}
            to="/store-menu"
            search={{ store: row.id }}
            className={`shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition ${
              row.id === store?.id
                ? "bg-[#2B0B4D] text-white"
                : "bg-white text-[#5B4A6B] ring-1 ring-[#EFE7F6] hover:text-[#2B0B4D]"
            }`}
          >
            {row.name}
          </Link>
        ))}
      </div>

      {!store ? (
        <div className="mt-5">
          <EmptyState title="No stores open right now" description="Check back shortly — stores open every day from 8am." />
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
            {store.logo_url && (
              <Image
                src={store.logo_url}
                alt={`${store.name} logo`}
                className="mb-3 h-12 w-12 rounded-xl ring-1 ring-[#EFE7F6]"
                fittingType="fill"
              />
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-semibold text-[#5B4A6B]">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#FFB020] text-[#FFB020]" /> {store.rating ?? "4.5"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-[#1F7A4C]" /> {store.eta_min ?? 20}–{store.eta_max ?? 35} min
              </span>
              <span className="flex items-center gap-1">
                <Bike className="h-3.5 w-3.5 text-[#FF7A00]" /> {formatNGN(store.delivery_fee)} delivery
              </span>
              <span className="flex items-center gap-1 text-[#8B7A9C]">
                <ShoppingBag className="h-3.5 w-3.5" /> {store.category}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-full bg-[#FBF8F3] px-3 py-2 ring-1 ring-[#F1E9F7]">
              <Search className="h-4 w-4 text-[#9A8CA8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${store.name}`}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#1B1024] outline-none placeholder:text-[#9A8CA8]"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-5">
              <EmptyState title="Nothing matches" description="Try a different dish or clear the search." />
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map(([category, items]) => (
                <section key={category}>
                  <h2 className="font-display text-[16px] font-bold text-[#1B1024]">{category}</h2>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((product) => {
                      const saved = favs.some((row) => row.product_id === product.id);
                      return (
                        <div
                          key={product.id}
                          className="flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-[#F1E9F7]"
                        >
                          <span
                            className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[26px] ${product.tint || "bg-[#F6EEFB]"}`}
                          >
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full"
                                fittingType="fill"
                              />
                            ) : (
                              product.emoji || "🍽️"
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-bold text-[#1B1024]">{product.name}</p>
                            <p className="truncate text-[11.5px] text-[#9A8CA8]">{product.unit || "1 portion"}</p>
                            <p className="mt-1 text-[13px] font-bold text-[#2B0B4D]">{formatNGN(product.price)}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleFav(product)}
                              disabled={busyFav === product.id}
                              aria-label={saved ? `Remove ${product.name} from favorites` : `Save ${product.name}`}
                              className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 transition ${
                                saved
                                  ? "bg-[#FFF1E4] text-[#FF7A00] ring-[#FFE2BC]"
                                  : "bg-white text-[#B5A7C2] ring-[#EFE7F6] hover:text-[#FF7A00]"
                              }`}
                            >
                              <Heart className="h-3.5 w-3.5" fill={saved ? "#FF7A00" : "none"} />
                            </button>
                            <button
                              type="button"
                              onClick={() => add(product)}
                              disabled={product.is_available === false}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2B0B4D] text-white transition hover:bg-[#3B0A66] disabled:opacity-40"
                              aria-label={`Add ${product.name} to basket`}
                            >
                              <Plus className="h-4 w-4" strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {cart.count > 0 && (
        <div className="sticky bottom-4 z-30 mt-6">
          <Link
            to="/checkout"
            className="flex items-center justify-between rounded-2xl bg-[#2B0B4D] px-4 py-3 text-white shadow-[0_18px_40px_-18px_rgba(43,11,77,0.65)]"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold">
              <ShoppingBag className="h-4 w-4" /> {cart.count} in basket · {cart.store?.name}
            </span>
            <span className="flex items-center gap-2 text-[13px] font-bold">
              {formatNGN(cart.subtotal)} <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      )}
    </CustomerShell>
  );
}