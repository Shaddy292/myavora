import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

// Personal records are narrowed to the signed-in account, the local equivalent
// of row-level security: an address, card or favourite stays with its owner.
const mine = (ctx) => ctx.getDb().as(ctx.user.email);
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

/* --------------------------------------------------------------- addressbook */

export const accountBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = mine(context);
    const [addresses, cards, favorites] = await Promise.all([
      db.entities.Address.list("-created_date", 40),
      db.entities.PaymentMethod.list("-created_date", 20),
      db.entities.Favorite.list("-created_date", 60),
    ]);
    const sortDefault = (list) =>
      rows(list).sort((a, b) => Number(b.is_default) - Number(a.is_default));
    return {
      addresses: sortDefault(addresses),
      cards: sortDefault(cards),
      favorites: rows(favorites),
    };
  });

const AddressInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(40),
  line1: z.string().min(3).max(200),
  area: z.string().max(80).optional(),
  city: z.string().max(60).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(200).optional(),
  is_default: z.boolean().optional(),
});

export const saveAddress = createServerFn({ method: "POST" })
  .validator(AddressInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const { id, ...payload } = data;
    const saved = id
      ? await db.entities.Address.update(id, payload)
      : await db.entities.Address.create({ city: "Lagos", ...payload });
    if (payload.is_default) {
      const others = rows(await db.entities.Address.list("-created_date", 40));
      await Promise.all(
        others
          .filter((address) => address.id !== saved.id && address.is_default)
          .map((address) => db.entities.Address.update(address.id, { is_default: false }))
      );
    }
    return saved;
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await mine(context).entities.Address.delete(data.id);
    return { ok: true };
  });

export const setDefaultAddress = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const all = rows(await db.entities.Address.list("-created_date", 40));
    await Promise.all(
      all.map((address) => db.entities.Address.update(address.id, { is_default: address.id === data.id }))
    );
    return { ok: true };
  });

/* ------------------------------------------------------------ payment methods */

const CardInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(40),
  brand: z.enum(["visa", "mastercard", "verve", "amex", "other"]),
  last4: z.string().regex(/^\d{4}$/),
  exp_month: z.number().int().min(1).max(12),
  exp_year: z.number().int().min(2026).max(2050),
  holder: z.string().max(80).optional(),
  is_default: z.boolean().optional(),
});

export const savePaymentMethod = createServerFn({ method: "POST" })
  .validator(CardInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const { id, ...payload } = data;
    const saved = id
      ? await db.entities.PaymentMethod.update(id, payload)
      : await db.entities.PaymentMethod.create(payload);
    if (payload.is_default) {
      const others = rows(await db.entities.PaymentMethod.list("-created_date", 20));
      await Promise.all(
        others
          .filter((card) => card.id !== saved.id && card.is_default)
          .map((card) => db.entities.PaymentMethod.update(card.id, { is_default: false }))
      );
    }
    return saved;
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await mine(context).entities.PaymentMethod.delete(data.id);
    return { ok: true };
  });

export const setDefaultPaymentMethod = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const all = rows(await db.entities.PaymentMethod.list("-created_date", 20));
    await Promise.all(
      all.map((card) => db.entities.PaymentMethod.update(card.id, { is_default: card.id === data.id }))
    );
    return { ok: true };
  });

/* --------------------------------------------------------------- favourites */

const FavoriteInput = z.object({
  product_id: z.string(),
  name: z.string().max(90),
  price: z.number().min(0).max(10_000_000).optional(),
  emoji: z.string().max(8).optional(),
  tint: z.string().max(40).optional(),
  unit: z.string().max(40).optional(),
  store_id: z.string().optional(),
  store_name: z.string().max(80).optional(),
});

export const addFavorite = createServerFn({ method: "POST" })
  .validator(FavoriteInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const existing = rows(
      await db.entities.Favorite.filter({ product_id: data.product_id }, { limit: 1 })
    )[0];
    if (existing) return existing;
    return db.entities.Favorite.create({ ...data, user_email: context.user.email });
  });

export const removeFavorite = createServerFn({ method: "POST" })
  .validator(z.object({ product_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = mine(context);
    const matches = rows(await db.entities.Favorite.filter({ product_id: data.product_id }, { limit: 20 }));
    await Promise.all(matches.map((favorite) => db.entities.Favorite.delete(favorite.id)));
    return { ok: true };
  });

/* ------------------------------------------------------- reviews & tickets */

export const submitReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      store_id: z.string(),
      product_id: z.string().optional(),
      order_code: z.string().max(30).optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(600).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = context.getDb().asServiceRole;
    const store = await db.entities.Store.get(data.store_id).catch(() => null);
    if (!store) throw Object.assign(new Error("That store no longer exists."), { status: 404 });
    const product = data.product_id
      ? await db.entities.Product.get(data.product_id).catch(() => null)
      : null;
    return db.entities.Review.create({
      store_id: store.id,
      store_name: store.name,
      owner_email: store.owner_email,
      product_id: product?.id ?? "",
      product_name: product?.name ?? "",
      customer_email: context.user.email,
      customer_name: context.user.full_name || context.user.email,
      order_code: data.order_code ?? "",
      rating: data.rating,
      comment: data.comment ?? "",
    });
  });

export const openSupportTicket = createServerFn({ method: "POST" })
  .validator(
    z.object({
      topic: z.string().min(3).max(80),
      message: z.string().min(5).max(1500),
      order_code: z.string().max(30).optional(),
      priority: z.enum(["normal", "high", "urgent"]).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = context.getDb().asServiceRole;
    return db.entities.SupportTicket.create({
      order_code: data.order_code ?? "",
      customer_email: context.user.email,
      customer_name: context.user.full_name || context.user.email,
      topic: data.topic,
      message: data.message,
      priority: data.priority ?? "normal",
      status: "open",
      messages: [
        {
          from: context.user.email,
          body: data.message,
          at: new Date().toISOString(),
        },
      ],
    });
  });