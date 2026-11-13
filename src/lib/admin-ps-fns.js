import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { ACTIVE_STATUSES } from "@/lib/avora";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

async function staffRole(ctx) {
  if (ctx.user.role === "admin") return "admin";
  const staff = rows(
    await svc(ctx).entities.StaffMember.filter({ email: ctx.user.email, is_active: true })
  )[0];
  return staff?.role ?? "customer";
}

const ALLOWED = {
  settings: ["admin"],
  zones: ["admin", "ops"],
  catalogue: ["admin", "ops"],
  dispatch: ["admin", "ops"],
  money: ["admin", "finance"],
};

async function allow(ctx, area) {
  const role = await staffRole(ctx);
  if (!ALLOWED[area].includes(role)) {
    throw Object.assign(new Error("You do not have permission to manage this area."), { status: 403 });
  }
  return role;
}

const audit = (db, actor, action, target, detail, severity = "info") =>
  db.entities.AuditLog.create({ actor_email: actor.email, action, target, detail, severity });

/* --------------------------------------------------------------- settings */

export const platformSettings = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allow(context, "settings");
    const db = svc(context);
    const records = rows(await db.entities.PlatformSetting.list("-created_date", 5));
    return { setting: records[0] ?? null };
  });

const SettingsInput = z.object({
  business_name: z.string().min(2).max(80),
  legal_name: z.string().max(120).optional(),
  support_email: z.string().max(120).optional(),
  support_phone: z.string().max(40).optional(),
  service_fee_pct: z.number().min(0).max(50),
  delivery_base_fee: z.number().min(0).max(100_000),
  min_order_value: z.number().min(0).max(10_000_000),
  rider_payout_base: z.number().min(0).max(100_000),
  vendor_commission_pct: z.number().min(0).max(50),
  rider_commission_pct: z.number().min(0).max(50).optional(),
  vendor_join_fee: z.number().min(0).max(10_000_000).optional(),
  vendor_monthly_fee: z.number().min(0).max(1_000_000).optional(),
  auto_approve_vendors: z.boolean(),
  allow_cash_on_delivery: z.boolean(),
  maintenance_mode: z.boolean(),
  ops_note: z.string().max(600).optional(),
});

export const savePlatformSettings = createServerFn({ method: "POST" })
  .validator(SettingsInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "settings");
    const db = svc(context);
    const existing = rows(await db.entities.PlatformSetting.list("-created_date", 1))[0] ?? null;
    const payload = { ...data, updated_by: context.user.email };
    const saved = existing
      ? await db.entities.PlatformSetting.update(existing.id, payload)
      : await db.entities.PlatformSetting.create(payload);
    await audit(db, context.user, "settings.update", "PlatformSetting", "Platform settings saved", "warning");
    return saved;
  });

/* ---------------------------------------------------------- delivery zones */

export const deliveryZoneBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allow(context, "zones");
    const db = svc(context);
    const [zones, stores, orders] = await Promise.all([
      db.entities.DeliveryZone.list("-created_date", 100),
      db.entities.Store.list("-created_date", 200),
      db.entities.Order.list("-created_date", 200),
    ]);
    const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    return {
      zones: rows(zones).map((zone) => ({
        ...zone,
        storeCount: stores.filter((store) => (store.area || "") === (zone.area || zone.name)).length,
        activeOrders: active.filter((order) => (order.address_area || "") === (zone.area || zone.name)).length,
      })),
      uncovered: stores
        .filter((store) => !rows(zones).some((zone) => (zone.area || zone.name) === store.area))
        .slice(0, 10),
    };
  });

const ZoneInput = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60),
  area: z.string().max(60).optional(),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  radius_km: z.number().min(0.5).max(60),
  delivery_fee: z.number().min(0).max(100_000),
  is_active: z.boolean(),
  notes: z.string().max(400).optional(),
});

export const saveDeliveryZone = createServerFn({ method: "POST" })
  .validator(ZoneInput)
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "zones");
    const db = svc(context);
    const { id, ...payload } = data;
    const saved = id
      ? await db.entities.DeliveryZone.update(id, payload)
      : await db.entities.DeliveryZone.create(payload);
    await audit(db, context.user, id ? "zone.update" : "zone.create", saved.name, `${data.radius_km} km radius`);
    return saved;
  });

export const deleteDeliveryZone = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "zones");
    const db = svc(context);
    const zone = await db.entities.DeliveryZone.get(data.id).catch(() => null);
    if (!zone) throw Object.assign(new Error("That delivery area no longer exists."), { status: 404 });
    await db.entities.DeliveryZone.delete(data.id);
    await audit(db, context.user, "zone.delete", zone.name, "Delivery area removed", "warning");
    return { ok: true };
  });

/* --------------------------------------------------------------- catalogue */

export const adminCatalogue = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allow(context, "catalogue");
    const db = svc(context);
    const [products, stores, categories] = await Promise.all([
      db.entities.Product.list("-created_date", 400),
      db.entities.Store.list("-created_date", 200),
      db.entities.Category.list("position", 60),
    ]);
    return { products: rows(products), stores: rows(stores), categories: rows(categories) };
  });

export const adminUpdateProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(2).max(90).optional(),
      price: z.number().min(0).max(10_000_000).optional(),
      stock: z.number().int().min(0).max(100_000).optional(),
      category: z.string().max(60).optional(),
      is_available: z.boolean().optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "catalogue");
    const db = svc(context);
    const { id, ...patch } = data;
    const saved = await db.entities.Product.update(id, patch);
    await audit(db, context.user, "catalogue.update", saved.name, Object.keys(patch).join(", "));
    return saved;
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "catalogue");
    const db = svc(context);
    const product = await db.entities.Product.get(data.id).catch(() => null);
    if (!product) throw Object.assign(new Error("That item no longer exists."), { status: 404 });
    await db.entities.Product.delete(data.id);
    await audit(db, context.user, "catalogue.delete", product.name, "Listing removed", "warning");
    return { ok: true };
  });

/* ---------------------------------------------------------------- dispatch */

export const dispatchBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allow(context, "dispatch");
    const db = svc(context);
    const [orders, riders, zones] = await Promise.all([
      db.entities.Order.list("-created_date", 200),
      db.entities.RiderProfile.list("-created_date", 200),
      db.entities.DeliveryZone.list("-created_date", 60),
    ]);
    const active = orders.filter((order) =>
      ["ready_for_pickup", "rider_assigned", "picked_up", "preparing", "accepted"].includes(order.status)
    );
    return {
      orders: active,
      unassigned: active.filter((order) => !order.rider_email).length,
      riders: rows(riders).filter((rider) => rider.status === "approved"),
      zones: rows(zones),
    };
  });

export const assignRider = createServerFn({ method: "POST" })
  .validator(z.object({ order_id: z.string(), rider_email: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "dispatch");
    const db = svc(context);
    const [order, rider] = await Promise.all([
      db.entities.Order.get(data.order_id),
      db.entities.RiderProfile.filter({ user_email: data.rider_email }),
    ]);
    const profile = rows(rider)[0];
    if (!profile) throw Object.assign(new Error("That rider has no profile yet."), { status: 404 });
    if (profile.status !== "approved") {
      throw Object.assign(new Error("Only approved riders can be dispatched."), { status: 409 });
    }
    const at = new Date().toISOString();
    const saved = await db.entities.Order.update(order.id, {
      rider_email: profile.user_email,
      rider_name: profile.full_name,
      rider_phone: profile.phone,
      rider_payout: order.rider_payout || Math.round((order.delivery_fee || 500) * 0.9),
      status: order.status === "picked_up" ? order.status : "rider_assigned",
      timeline: [
        ...(order.timeline ?? []),
        { status: "rider_assigned", at, note: `Dispatched to ${profile.full_name}`, by: context.user.email },
      ],
    });
    await db.entities.Notification.create({
      user_email: profile.user_email,
      key: `dispatch-${order.id}-${Date.now()}`,
      kind: "order",
      title: "New delivery assigned",
      body: `${order.store_name} · ${order.address_area || order.address_label || "delivery"}`,
      link: "/rider",
      order_code: order.code,
    });
    await audit(db, context.user, "dispatch.assign", order.code, `Rider ${profile.full_name}`);
    return saved;
  });

export const releaseRider = createServerFn({ method: "POST" })
  .validator(z.object({ order_id: z.string(), note: z.string().max(200).optional() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "dispatch");
    const db = svc(context);
    const order = await db.entities.Order.get(data.order_id);
    if (!order.rider_email) return order;
    const saved = await db.entities.Order.update(order.id, {
      rider_email: "",
      rider_name: "",
      rider_phone: "",
      status: "ready_for_pickup",
      timeline: [
        ...(order.timeline ?? []),
        {
          status: "ready_for_pickup",
          at: new Date().toISOString(),
          note: data.note || "Rider removed — waiting for a new dispatch",
          by: context.user.email,
        },
      ],
    });
    await audit(db, context.user, "dispatch.release", order.code, "Rider unassigned", "warning");
    return saved;
  });

/* ----------------------------------------------------------------- refunds */

export const refundBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allow(context, "money");
    const db = svc(context);
    const [refunds, orders] = await Promise.all([
      db.entities.Refund.list("-created_date", 150),
      db.entities.Order.filter(
        { payment_status: { $in: ["paid", "cash_due"] } },
        { sort: "-created_date", limit: 120 }
      ),
    ]);
    return { refunds: rows(refunds), orders: rows(orders) };
  });

export const updateRefund = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["approved", "rejected", "processed"]),
      note: z.string().max(400).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allow(context, "money");
    const db = svc(context);
    const refund = await db.entities.Refund.get(data.id);
    const saved = await db.entities.Refund.update(refund.id, {
      status: data.status,
      note: data.note ?? refund.note ?? "",
      decided_by: context.user.email,
    });
    if (["approved", "processed"].includes(data.status) && refund.order_id) {
      await db.entities.Order.update(refund.order_id, { payment_status: "refunded" }).catch(() => null);
      await db.entities.Payment.updateMany(
        { order_id: refund.order_id },
        { $set: { status: "refunded", note: `Refund ${data.status}` } }
      );
      await db.entities.Notification.create({
        user_email: refund.customer_email,
        key: `refund-${refund.id}-${data.status}`,
        kind: "order",
        title: data.status === "processed" ? "Refund paid out" : "Refund approved",
        body: `Order ${refund.order_code} · ₦${Math.round(refund.amount || 0).toLocaleString("en-NG")}`,
        link: "/payment-history",
        order_code: refund.order_code,
      });
    }
    await audit(db, context.user, `refund.${data.status}`, refund.order_code, data.note || "", "warning");
    return saved;
  });

export const openRefund = createServerFn({ method: "POST" })
  .validator(
    z.object({
      order_id: z.string(),
      amount: z.number().min(1).max(10_000_000),
      reason: z.string().min(4).max(300),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const order = await db.entities.Order.get(data.order_id).catch(() => null);
    if (!order) throw Object.assign(new Error("That order no longer exists."), { status: 404 });
    const role = await staffRole(context);
    const staff = ["admin", "finance", "support", "ops"].includes(role);
    if (!staff && order.customer_email !== context.user.email) {
      throw Object.assign(new Error("You can only request a refund on your own order."), { status: 403 });
    }
    const refund = await db.entities.Refund.create({
      order_id: order.id,
      order_code: order.code,
      customer_email: order.customer_email,
      amount: Math.min(data.amount, order.total || data.amount),
      reason: data.reason,
      status: "requested",
      requested_by: context.user.email,
    });
    await audit(db, context.user, "refund.request", order.code, `₦${data.amount}`, "warning");
    return refund;
  });