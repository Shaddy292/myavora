import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

const audit = (db, actor, action, target, detail) =>
  db.entities.AuditLog.create({
    actor_email: actor.email,
    action,
    target,
    detail,
    severity: "info",
  });

async function ownStore(ctx) {
  const store = rows(await svc(ctx).entities.Store.filter({ owner_email: ctx.user.email }))[0];
  if (!store) {
    throw Object.assign(new Error("No store is linked to your account yet."), { status: 403 });
  }
  return store;
}

const ProductInput = z.object({
  name: z.string().min(2).max(90),
  price: z.number().min(0).max(10_000_000),
  stock: z.number().int().min(0).max(100_000).optional(),
  unit: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
  description: z.string().max(400).optional(),
  image_url: z.string().max(600).optional(),
  emoji: z.string().max(8).optional(),
  is_available: z.boolean().optional(),
});

/* ------------------------------------------------------------- catalogue */

export const vendorCatalogue = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const store = rows(await db.entities.Store.filter({ owner_email: context.user.email }))[0] ?? null;
    if (!store) return { store: null, products: [] };
    const products = rows(
      await db.entities.Product.filter({ store_id: store.id }, { sort: "name", limit: 200 })
    );
    return { store, products };
  });

export const createVendorProduct = createServerFn({ method: "POST" })
  .validator(ProductInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await ownStore(context);
    const product = await db.entities.Product.create({
      ...data,
      stock: data.stock ?? 0,
      unit: data.unit || "1 portion",
      store_id: store.id,
      store_name: store.name,
      owner_email: context.user.email,
      is_available: data.is_available ?? true,
      tint: "bg-[#F6EEFB]",
    });
    await audit(db, context.user, "product.create", product.name, `Added to ${store.name}`);
    return product;
  });

const PatchInput = z.object({
  id: z.string(),
  name: z.string().min(2).max(90).optional(),
  price: z.number().min(0).max(10_000_000).optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  unit: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
  description: z.string().max(400).optional(),
  image_url: z.string().max(600).optional(),
  emoji: z.string().max(8).optional(),
  is_available: z.boolean().optional(),
});

export const updateVendorProduct = createServerFn({ method: "POST" })
  .validator(PatchInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await ownStore(context);
    const { id, ...patch } = data;
    const current = await db.entities.Product.get(id).catch(() => null);
    if (!current || (current.store_id !== store.id && current.owner_email !== context.user.email)) {
      throw Object.assign(new Error("That item is not part of your store."), { status: 403 });
    }
    return db.entities.Product.update(id, patch);
  });

export const deleteVendorProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await ownStore(context);
    const current = await db.entities.Product.get(data.id).catch(() => null);
    if (!current || (current.store_id !== store.id && current.owner_email !== context.user.email)) {
      throw Object.assign(new Error("That item is not part of your store."), { status: 403 });
    }
    await db.entities.Product.delete(data.id);
    await audit(db, context.user, "product.delete", current.name, `Removed from ${store.name}`);
    return { ok: true };
  });

/* -------------------------------------------------------------- storefront */

const StoreInput = z.object({
  name: z.string().min(2).max(80).optional(),
  category: z.string().max(60).optional(),
  tagline: z.string().max(140).optional(),
  promo: z.string().max(80).optional(),
  address: z.string().max(160).optional(),
  area: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  delivery_fee: z.number().min(0).max(100_000).optional(),
  min_order: z.number().min(0).max(10_000_000).optional(),
  eta_min: z.number().min(1).max(240).optional(),
  eta_max: z.number().min(1).max(240).optional(),
  is_open: z.boolean().optional(),
  logo_url: z.string().max(600).optional(),
  cover_url: z.string().max(600).optional(),
  photos: z.array(z.string().max(600)).max(12).optional(),
});

export const saveVendorStore = createServerFn({ method: "POST" })
  .validator(StoreInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await ownStore(context);
    if (data.name && data.name !== store.name) {
      await db.entities.Product.updateMany(
        { store_id: store.id },
        { $set: { store_name: data.name } }
      );
    }
    const updated = await db.entities.Store.update(store.id, data);
    await audit(db, context.user, "store.update", updated.name, "Storefront details saved");
    return updated;
  });

export const toggleVendorStore = createServerFn({ method: "POST" })
  .validator(z.object({ is_open: z.boolean() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const store = await ownStore(context);
    const updated = await db.entities.Store.update(store.id, { is_open: data.is_open });
    await audit(
      db,
      context.user,
      "store.toggle",
      updated.name,
      data.is_open ? "Store opened for orders" : "Store paused"
    );
    return updated;
  });