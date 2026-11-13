import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { promoDiscount, promoProblem } from "@/lib/promo";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

async function isAdmin(ctx) {
  if (ctx.user.role === "admin") return true;
  const staff = await svc(ctx).entities.StaffMember.filter({ email: ctx.user.email, is_active: true });
  return staff[0]?.role === "admin";
}

async function assertAdmin(ctx) {
  if (!(await isAdmin(ctx))) {
    throw Object.assign(new Error("Only administrators can do that."), { status: 403 });
  }
}

const audit = (db, actor, action, target, detail, severity = "info") =>
  db.entities.AuditLog.create({ actor_email: actor.email, action, target, detail, severity });

/* ---------------------------------------------------------------- reviews */

export const reviewBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const admin = await isAdmin(context);
    const [reviews, products] = await Promise.all([
      admin
        ? db.entities.Review.list("-created_date", 300)
        : db.entities.Review.filter(
            { owner_email: context.user.email },
            { sort: "-created_date", limit: 300 }
          ),
      admin
        ? db.entities.Product.list("-created_date", 400)
        : db.entities.Product.filter({ owner_email: context.user.email }, { limit: 400 }),
    ]);
    return { admin, reviews: rows(reviews), products: rows(products) };
  });

export const replyToReview = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), reply: z.string().min(2).max(1000) }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const review = await db.entities.Review.get(data.id);
    if (!(await isAdmin(context)) && review.owner_email !== context.user.email) {
      throw Object.assign(new Error("You can only reply to reviews on your own products."), { status: 403 });
    }
    return db.entities.Review.update(data.id, {
      vendor_reply: data.reply,
      replied_at: new Date().toISOString(),
    });
  });

export const flagReview = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), flagged: z.boolean(), reason: z.string().max(300).optional() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const review = await db.entities.Review.get(data.id);
    if (!(await isAdmin(context)) && review.owner_email !== context.user.email) {
      throw Object.assign(new Error("You can only flag reviews on your own products."), { status: 403 });
    }
    return db.entities.Review.update(data.id, {
      is_flagged: data.flagged,
      flag_reason: data.flagged ? data.reason ?? "Flagged for moderation" : "",
    });
  });

export const moderateReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      action: z.enum(["hide", "unhide", "clear_flag"]),
      note: z.string().max(300).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const review = await db.entities.Review.get(data.id);
    const patch =
      data.action === "hide"
        ? { is_hidden: true, moderation_note: data.note ?? "Hidden by administrator" }
        : data.action === "unhide"
          ? { is_hidden: false, moderation_note: data.note ?? "Restored by administrator" }
          : { is_flagged: false, flag_reason: "", moderation_note: data.note ?? "Flag cleared" };
    const updated = await db.entities.Review.update(data.id, patch);
    await audit(
      db,
      context.user,
      `review.${data.action}`,
      review.product_name || review.store_name || review.id,
      `Review ${data.action} by ${context.user.email}`,
      data.action === "unhide" ? "info" : "warning"
    );
    return updated;
  });

/* --------------------------------------------------------------- accounts */

export const accountDirectory = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) return { admin: false, accounts: [], totals: null };
    const db = svc(context);
    const [users, stores, riders, staff] = await Promise.all([
      db.entities.User.list("-created_date", 500),
      db.entities.Store.list("-created_date", 300),
      db.entities.RiderProfile.list("-created_date", 300),
      db.entities.StaffMember.list("-created_date", 100),
    ]);
    const storeRows = rows(stores);
    const riderRows = rows(riders);
    const staffRows = rows(staff);
    const accounts = rows(users).map((user) => {
      const store = storeRows.find((row) => row.owner_email === user.email);
      const rider = riderRows.find((row) => row.user_email === user.email);
      const member = staffRows.find((row) => row.email === user.email);
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        joined: user.created_date,
        store_name: store?.name ?? null,
        store_approved: store ? !!store.is_approved : null,
        rider_status: rider?.status ?? null,
        staff_role: member?.role ?? null,
      };
    });
    return {
      admin: true,
      accounts,
      me: context.user.email,
      totals: {
        all: accounts.length,
        admins: accounts.filter((row) => row.role === "admin").length,
        vendors: accounts.filter((row) => row.store_name).length,
        riders: accounts.filter((row) => row.rider_status).length,
        customers: accounts.filter((row) => !row.store_name && !row.rider_status).length,
      },
    };
  });

export const setAccountRole = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), role: z.enum(["user", "admin"]) }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const updated = await db.entities.User.update(data.id, { role: data.role });
    await audit(db, context.user, "account.role", updated.email, `Role set to ${data.role}`, "warning");
    return { ok: true };
  });

/* ------------------------------------------------------------- promo codes */

export const promoCodeBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) return { admin: false, codes: [] };
    const db = svc(context);
    const codes = rows(await db.entities.PromoCode.list("-created_date", 200));
    return { admin: true, codes };
  });

const PROMO_INPUT = z.object({
  id: z.string().optional(),
  code: z.string().min(2).max(30),
  description: z.string().max(160).optional(),
  discount_type: z.enum(["percent", "fixed"]),
  value: z.number().min(0).max(1000000),
  min_order: z.number().min(0).default(0),
  max_discount: z.number().min(0).default(0),
  usage_limit: z.number().min(0).default(0),
  expires_at: z.string().max(40).optional(),
  is_active: z.boolean().default(true),
  store_id: z.string().max(60).optional(),
});

export const savePromoCode = createServerFn({ method: "POST" })
  .validator(PROMO_INPUT)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const { id, ...rest } = data;
    const record = {
      ...rest,
      code: data.code.trim().toUpperCase(),
      description: data.description?.trim() ?? "",
      expires_at: data.expires_at || "",
      store_id: data.store_id || "",
      created_by: context.user.email,
    };
    if (!id) {
      const clash = rows(await db.entities.PromoCode.filter({ code: record.code }));
      if (clash.length) throw Object.assign(new Error("That promo code already exists."), { status: 409 });
    }
    const saved = id
      ? await db.entities.PromoCode.update(id, record)
      : await db.entities.PromoCode.create({ ...record, used_count: 0 });
    await audit(
      db,
      context.user,
      id ? "promo.updated" : "promo.created",
      record.code,
      `${record.code} ${record.is_active ? "active" : "paused"} · ${record.value}${record.discount_type === "percent" ? "%" : " fixed"}`,
      "info"
    );
    return saved;
  });

export const setPromoActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), is_active: z.boolean() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const updated = await db.entities.PromoCode.update(data.id, { is_active: data.is_active });
    await audit(
      db,
      context.user,
      data.is_active ? "promo.activated" : "promo.paused",
      updated.code,
      `Promo ${updated.code} ${data.is_active ? "activated" : "paused"}`,
      "info"
    );
    return updated;
  });

export const deletePromoCode = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const promo = await db.entities.PromoCode.get(data.id);
    await db.entities.PromoCode.delete(data.id);
    await audit(db, context.user, "promo.deleted", promo.code, `Promo ${promo.code} deleted`, "critical");
    return { ok: true };
  });

export const previewPromo = createServerFn({ method: "POST" })
  .validator(
    z.object({
      code: z.string().min(2).max(30),
      subtotal: z.number().min(0),
      store_id: z.string().max(60).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const promo = rows(
      await db.entities.PromoCode.filter({ code: data.code.trim().toUpperCase() })
    )[0];
    const problem = promoProblem(promo, data.subtotal, data.store_id);
    if (problem) throw Object.assign(new Error(problem), { status: 400 });
    return {
      code: promo.code,
      description: promo.description ?? "",
      discount: promoDiscount(promo, data.subtotal),
    };
  });

/* ----------------------------------------------------------------- money */

export const paymentLedger = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const email = context.user.email;
    const [orders, payments, settlements, stores, riders] = await Promise.all([
      db.entities.Order.filter({ customer_email: email }, { sort: "-created_date", limit: 100 }),
      db.entities.Payment.filter({ customer_email: email }, { sort: "-created_date", limit: 100 }),
      db.entities.Settlement.filter({ subject_email: email }, { sort: "-created_date", limit: 100 }),
      db.entities.Store.filter({ owner_email: email }),
      db.entities.RiderProfile.filter({ user_email: email }),
    ]);
    return {
      orders: rows(orders),
      payments: rows(payments),
      settlements: rows(settlements),
      store: rows(stores)[0] ?? null,
      rider: rows(riders)[0] ?? null,
    };
  });

/* ------------------------------------------------------------- categories */

export const categoryBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context))) return { admin: false, categories: [] };
    const db = svc(context);
    const categories = rows(await db.entities.Category.list({ sort: "position", limit: 200 }));
    return { admin: true, categories };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().min(2).max(40),
      emoji: z.string().max(8).optional(),
      description: z.string().max(120).optional(),
      is_active: z.boolean().default(true),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const name = data.name.trim();
    const existing = rows(await db.entities.Category.list({ sort: "position", limit: 200 }));
    const clash = existing.find(
      (row) => row.name.toLowerCase() === name.toLowerCase() && row.id !== data.id
    );
    if (clash) throw Object.assign(new Error("That category already exists."), { status: 409 });
    const record = {
      name,
      emoji: data.emoji?.trim() || "🍽️",
      description: data.description?.trim() ?? "",
      is_active: data.is_active,
    };
    const saved = data.id
      ? await db.entities.Category.update(data.id, record)
      : await db.entities.Category.create({
          ...record,
          tint: "bg-[#F6EEFB]",
          position: existing.length,
        });
    await audit(
      db,
      context.user,
      data.id ? "category.updated" : "category.created",
      name,
      `Category ${name} ${record.is_active ? "visible" : "hidden"}`,
      "info"
    );
    return saved;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    const category = await db.entities.Category.get(data.id);
    await db.entities.Category.delete(data.id);
    await audit(db, context.user, "category.deleted", category.name, `Category ${category.name} deleted`, "critical");
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100) }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = svc(context);
    await db.entities.Category.bulkUpdate(
      data.ids.map((id, index) => ({ id, position: index }))
    );
    await audit(db, context.user, "category.reordered", "Store directory", "Directory category order changed", "info");
    return { ok: true };
  });

export const vendorPayoutBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const email = context.user.email;
    const store = rows(await db.entities.Store.filter({ owner_email: email }))[0] ?? null;
    const [settlements, orders] = await Promise.all([
      db.entities.Settlement.filter({ subject_email: email }, { sort: "-created_date", limit: 60 }),
      store ? db.entities.Order.filter({ store_id: store.id }, { sort: "-created_date", limit: 200 }) : [],
    ]);
    return { store, settlements: rows(settlements), orders: rows(orders) };
  });