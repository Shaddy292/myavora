import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { ACTIVE_STATUSES, formatNGN } from "@/lib/avora";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

const matches = (value, needle) => (value || "").toLowerCase().includes(needle);

/* ------------------------------------------------------- public storefront */

export const homeFeed = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const db = svc(context);
  const [stores, categories, products, storeCount] = await Promise.all([
    db.entities.Store.filter({ is_approved: true, is_open: true }, { sort: "-rating", limit: 60 }),
    db.entities.Category.filter({ is_active: true }, { sort: "position", limit: 12 }),
    db.entities.Product.filter({ is_available: true }, { sort: "-created_date", limit: 12 }),
    db.entities.Store.count({ is_approved: true }),
  ]);

  return {
    storeCount: Number(storeCount) || 0,
    categories: rows(categories).map((category) => ({
      label: category.name,
      emoji: category.emoji || "🍽️",
      tint: category.tint || "bg-[#F6EEFB]",
    })),
    stores: rows(stores).map((store) => ({
      id: store.id,
      name: store.name,
      category: store.category || "",
      cuisine: store.tagline || store.category || "",
      rating: store.rating ?? "—",
      eta: `${store.eta_min ?? 20}–${store.eta_max ?? 35} min`,
      fee: store.delivery_fee ? `${formatNGN(store.delivery_fee)} delivery` : "Free delivery",
      promo: store.promo || "",
      cover: store.cover_url || (store.photos ?? [])[0] || "",
    })),
    essentials: rows(products).map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit || product.category || "",
      price: formatNGN(product.price),
      emoji: product.emoji || "🛍️",
      tint: product.tint || "bg-[#F6EEFB]",
      image_url: product.image_url || "",
    })),
  };
});

/* --------------------------------------------------------------- browsing */

export const browseStores = createServerFn({ method: "GET" })
  .validator(
    z.object({ q: z.string().max(60).optional(), category: z.string().max(60).optional() }).optional()
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const [stores, categories] = await Promise.all([
      db.entities.Store.list("-created_date", 200),
      db.entities.Category.filter({ is_active: true }, { sort: "position", limit: 40 }),
    ]);

    const needle = (data?.q || "").trim().toLowerCase();
    let list = stores.filter((store) => store.is_approved !== false);
    if (data?.category && data.category !== "All") {
      list = list.filter((store) => store.category === data.category);
    }
    if (needle) {
      list = list.filter(
        (store) =>
          matches(store.name, needle) ||
          matches(store.tagline, needle) ||
          matches(store.category, needle) ||
          matches(store.area, needle)
      );
    }

    return { stores: list, categories: rows(categories) };
  });

export const storeMenu = createServerFn({ method: "GET" })
  .validator(z.object({ store_id: z.string(), q: z.string().max(60).optional() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await db.entities.Store.get(data.store_id).catch(() => null);
    if (!store) return { store: null, products: [], reviews: 0, rating: store?.rating ?? 0 };

    const [products, reviews] = await Promise.all([
      db.entities.Product.filter(
        { store_id: store.id, is_available: true },
        { sort: "name", limit: 200 }
      ),
      db.entities.Review.filter({ store_id: store.id }, { limit: 100 }),
    ]);

    const needle = (data.q || "").trim().toLowerCase();
    const list = needle
      ? rows(products).filter(
          (product) => matches(product.name, needle) || matches(product.category, needle)
        )
      : rows(products);

    const ratings = rows(reviews).filter((review) => !review.is_hidden);
    const rating = ratings.length
      ? Math.round((ratings.reduce((sum, review) => sum + (review.rating || 0), 0) / ratings.length) * 10) / 10
      : store.rating ?? 4.5;

    return { store, products: list, reviews: ratings.length, rating };
  });

export const offersBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const [promos, stores] = await Promise.all([
      db.entities.PromoCode.filter({ is_active: true }, { sort: "-created_date", limit: 40 }),
      db.entities.Store.list("-rating", 60),
    ]);
    const now = Date.now();
    const live = rows(promos).filter(
      (promo) =>
        (!promo.expires_at || new Date(promo.expires_at).getTime() > now) &&
        (!promo.usage_limit || (promo.used_count || 0) < promo.usage_limit)
    );
    return {
      promos: live,
      stores: stores.filter((store) => store.is_approved !== false && store.is_open !== false),
    };
  });

/* ----------------------------------------------------------- customer home */

export const customerHome = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const email = context.user.email;
    const [stores, products, categories, orders, favorites, promos, unread] = await Promise.all([
      db.entities.Store.list("-rating", 60),
      db.entities.Product.filter({ is_available: true }, { sort: "-created_date", limit: 60 }),
      db.entities.Category.filter({ is_active: true }, { sort: "position", limit: 20 }),
      db.entities.Order.filter({ customer_email: email }, { sort: "-created_date", limit: 10 }),
      db.entities.Favorite.filter({ user_email: email }, { limit: 20 }),
      db.entities.PromoCode.filter({ is_active: true }, { sort: "-created_date", limit: 10 }),
      db.entities.Notification.filter({ user_email: email, is_read: false }, { limit: 50 }),
    ]);

    const approved = stores.filter((store) => store.is_approved !== false);
    const open = approved.filter((store) => store.is_open !== false);
    const recent = rows(orders);
    const now = Date.now();

    return {
      stores: approved.slice(0, 8),
      openStores: open.length,
      categories: rows(categories),
      products: rows(products),
      activeOrder: recent.find((order) => ACTIVE_STATUSES.includes(order.status)) ?? null,
      recentOrders: recent.slice(0, 4),
      favorites: rows(favorites),
      promos: rows(promos).filter(
        (promo) => !promo.expires_at || new Date(promo.expires_at).getTime() > now
      ),
      unread: rows(unread).length,
    };
  });