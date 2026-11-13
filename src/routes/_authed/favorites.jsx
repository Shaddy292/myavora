import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import EmptyState from "@/components/avora/EmptyState";
import { formatNGN } from "@/lib/avora";
import { addToCart, clearCart, useCart } from "@/lib/cart";
import { Heart, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/favorites")({
  loader: async () => ({
    favorites: await db.entities.Favorite.list("-created_date", 100),
    orders: await db.entities.Order.filter(
      { customer_email: (await db.auth.me()).email, status: "delivered" },
      { sort: "-created_date", limit: 10 }
    ),
  }),
  head: () => ({ meta: [{ title: "Favorites · AVORA" }] }),
  component: Favorites,
});

function Favorites() {
  const { favorites, orders } = Route.useLoaderData();
  const navigate = useNavigate();
  const cart = useCart();
  const [items, setItems] = useState(() => favorites);
  const [removing, setRemoving] = useState(null);

  const pastOrders = orders.items ?? orders;
  const frequent = new Map();
  for (const order of pastOrders) {
    for (const item of order.items ?? []) {
      const bucket = frequent.get(item.name) ?? {
        product_id: item.product_id,
        name: item.name,
        price: item.unit_price,
        qty: 0,
        store_id: order.store_id,
        store_name: order.store_name,
        delivery_fee: order.delivery_fee || 0,
      };
      bucket.qty += item.qty || 0;
      frequent.set(item.name, bucket);
    }
  }
  const frequentlyOrdered = [...frequent.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);

  const add = (item) => {
    if (cart.store && cart.store.id !== item.store_id) {
      clearCart();
      toast(`Started a fresh basket from ${item.store_name}`);
    }
    addToCart({
      product_id: item.product_id,
      name: item.name,
      price: item.price || 0,
      emoji: item.emoji || "🍽️",
      tint: item.tint || "bg-[#F6EEFB]",
      unit: item.unit || "",
      store_id: item.store_id,
      store_name: item.store_name,
      delivery_fee: item.delivery_fee || 0,
    });
    navigate({ to: "/checkout" });
  };

  const restore = (favorite) =>
    setItems((current) => (current.some((row) => row.id === favorite.id) ? current : [...current, favorite]));

  // Optimistic: the card disappears at once and comes back if the server rejects it.
  const remove = async (favorite) => {
    setRemoving(favorite.id);
    setItems((current) => current.filter((row) => row.id !== favorite.id));
    try {
      await db.entities.Favorite.delete(favorite.id);
      toast.success(`${favorite.name} removed`);
    } catch (error) {
      restore(favorite);
      toast.error(error?.message || "Could not remove this favorite");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <CustomerShell>
      <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">Favorites</h1>
      <p className="text-[13px] text-[#8B7A9C]">Saved items and the things you order most, ready in one tap.</p>

      <section className="mt-5">
        <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Saved items</h2>
        {items.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="Nothing saved yet"
              description="Tap the heart on any item in a store menu to keep it here."
              action={
                <Link to="/store-menu" className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white">
                  Browse a store
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((favorite) => (
              <div key={favorite.id} className="rounded-2xl bg-white p-3 ring-1 ring-[#F1E9F7]">
                <div className="flex items-start gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-[22px] ${favorite.tint || "bg-[#F6EEFB]"}`}>
                    {favorite.emoji || "🍽️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-[#1B1024]">{favorite.name}</p>
                    <p className="truncate text-[11.5px] text-[#9A8CA8]">{favorite.store_name}</p>
                    <p className="mt-0.5 text-[13px] font-bold text-[#2B0B4D]">{formatNGN(favorite.price)}</p>
                  </div>
                  <Heart className="h-4 w-4 shrink-0 fill-[#FF7A00] text-[#FF7A00]" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => add(favorite)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-[#2B0B4D] px-3 py-2 text-[11.5px] font-bold text-white transition hover:bg-[#3B0A66]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to basket
                  </button>
                  <button
                    type="button"
                    disabled={removing === favorite.id}
                    onClick={() => remove(favorite)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#B5A7C2] ring-1 ring-[#EFE7F6] transition hover:text-[#A11D1D]"
                    aria-label={`Remove ${favorite.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <h2 className="font-display text-[16px] font-bold text-[#1B1024]">You order these often</h2>
        {frequentlyOrdered.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-[#9A8CA8]">
            Once you complete a delivery, your most ordered items show up here.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frequentlyOrdered.map((item) => (
              <div key={item.name} className="rounded-2xl bg-white p-3 ring-1 ring-[#F1E9F7]">
                <p className="truncate text-[13.5px] font-bold text-[#1B1024]">{item.name}</p>
                <p className="truncate text-[11.5px] text-[#9A8CA8]">
                  {item.store_name} · ordered {item.qty}×
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(item.price)}</span>
                  <button
                    type="button"
                    onClick={() => add(item)}
                    className="flex items-center gap-1 rounded-full bg-[#FFF1E4] px-3 py-1.5 text-[11.5px] font-bold text-[#B05C00] transition hover:bg-[#FFE6CC]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </CustomerShell>
  );
}