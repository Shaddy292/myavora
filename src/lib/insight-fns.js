import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { ACTIVE_STATUSES, ORDER_STATUS } from "@/lib/avora";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);
const monthKey = (value) => new Date(value).toISOString().slice(0, 7);
const minutesBetween = (from, to) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);

async function staffRole(ctx) {
  if (ctx.user.role === "admin") return "admin";
  const staff = rows(await svc(ctx).entities.StaffMember.filter({ email: ctx.user.email, is_active: true }));
  return staff[0]?.role ?? "customer";
}

async function requireStaff(ctx, roles = ["admin", "ops", "finance"]) {
  const role = await staffRole(ctx);
  if (!roles.includes(role)) {
    throw Object.assign(new Error("You do not have permission to open this area."), { status: 403 });
  }
  return role;
}

/* ------------------------------------------------------- vendor analytics */

function prepMinutes(order) {
  const timeline = order.timeline ?? [];
  const accepted = timeline.find((entry) => entry.status === "accepted");
  const ready = timeline.find((entry) => entry.status === "ready_for_pickup");
  if (!accepted || !ready) return null;
  return minutesBetween(accepted.at, ready.at);
}

export const vendorMonthlyInsights = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const store = (await db.entities.Store.filter({ owner_email: context.user.email }))[0];
    if (!store) return { store: null };

    const orders = rows(await db.entities.Order.filter({ store_id: store.id }, { sort: "-created_date", limit: 400 }));
    const delivered = orders.filter((order) => order.status === "delivered");

    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);
      const key = monthKey(date);
      const monthOrders = orders.filter((order) => monthKey(order.created_date) === key);
      const monthDelivered = monthOrders.filter((order) => order.status === "delivered");
      months.push({
        key,
        month: date.toLocaleString("en-GB", { month: "short" }),
        sales: monthDelivered.reduce((sum, order) => sum + (order.total || 0), 0),
        orders: monthOrders.length,
        ratings: monthDelivered.filter((order) => order.rating).map((order) => order.rating),
      });
    }

    const productMap = new Map();
    for (const order of delivered) {
      for (const item of order.items ?? []) {
        const bucket = productMap.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
        bucket.qty += item.qty || 0;
        bucket.revenue += (item.unit_price || 0) * (item.qty || 0);
        productMap.set(item.name, bucket);
      }
    }

    const prepTimes = orders.map(prepMinutes).filter((value) => typeof value === "number" && value >= 0);
    const ratings = delivered.map((order) => order.rating).filter(Boolean);

    return {
      store,
      months: months.map(({ ratings: monthRatings, ...month }) => ({
        ...month,
        rating: monthRatings.length
          ? Math.round((monthRatings.reduce((a, b) => a + b, 0) / monthRatings.length) * 10) / 10
          : null,
      })),
      totals: {
        sales: delivered.reduce((sum, order) => sum + (order.total || 0), 0),
        delivered: delivered.length,
        orders: orders.length,
        avgOrder: delivered.length
          ? Math.round(delivered.reduce((sum, order) => sum + (order.total || 0), 0) / delivered.length)
          : 0,
        avgPrep: prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : null,
        fastestPrep: prepTimes.length ? Math.min(...prepTimes) : null,
        rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        rated: ratings.length,
      },
      topProducts: [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
      recentPrep: orders
        .filter((order) => prepMinutes(order) !== null)
        .slice(0, 8)
        .map((order) => ({ id: order.id, code: order.code, minutes: prepMinutes(order), at: order.created_date })),
    };
  });

/* --------------------------------------------------------- rider payouts */

export const riderPayoutBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireStaff(context, ["admin", "finance"]);
    const db = svc(context);
    const [settlements, riders, orders] = await Promise.all([
      db.entities.Settlement.list("-created_date", 200),
      db.entities.RiderProfile.list("-created_date", 100),
      db.entities.Order.list("-created_date", 400),
    ]);

    const riderSettlements = settlements.filter((row) => row.subject_type === "rider");
    const delivered = orders.filter((order) => order.status === "delivered" && order.rider_email);

    const board = riders.map((rider) => {
      const mine = delivered.filter((order) => order.rider_email === rider.user_email);
      const earned = mine.reduce((sum, order) => sum + (order.rider_payout || 0), 0);
      const paid = riderSettlements
        .filter((row) => row.subject_email === rider.user_email && row.status === "paid")
        .reduce((sum, row) => sum + (row.net || 0), 0);
      return {
        email: rider.user_email,
        name: rider.full_name,
        status: rider.status,
        deliveries: rider.deliveries_count || 0,
        earned,
        paid,
        balance: earned - paid,
        cash: rider.cash_on_hand || 0,
      };
    });

    return {
      board: board.sort((a, b) => b.balance - a.balance),
      totals: {
        earned: board.reduce((sum, row) => sum + row.earned, 0),
        paid: board.reduce((sum, row) => sum + row.paid, 0),
        pending: riderSettlements.filter((row) => row.status === "pending").reduce((sum, row) => sum + (row.net || 0), 0),
        cash: board.reduce((sum, row) => sum + row.cash, 0),
      },
      settlements: riderSettlements,
    };
  });

/* ---------------------------------------------------------- delivery map */

export const adminFleetBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireStaff(context);
    const db = svc(context);
    const [orders, riders] = await Promise.all([
      db.entities.Order.list("-created_date", 200),
      db.entities.RiderProfile.list("-created_date", 100),
    ]);
    const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
    return {
      deliveries: active.map((order) => ({
        id: order.id,
        code: order.code,
        status: order.status,
        store_name: order.store_name,
        store_id: order.store_id,
        address_area: order.address_area,
        address_line: order.address_line,
        rider_name: order.rider_name,
        rider_email: order.rider_email,
        total: order.total,
        created_date: order.created_date,
      })),
      riderPositions: riders
        .filter((rider) => rider.is_online && rider.status === "approved")
        .map((rider) => ({
          name: rider.full_name,
          email: rider.user_email,
          zone: rider.zone,
          deliveries: rider.deliveries_count || 0,
        })),
    };
  });

/* ---------------------------------------------------------- audit trail */

export const adminAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireStaff(context, ["admin"]);
    const logs = await svc(context).entities.AuditLog.list("-created_date", 250);
    return logs;
  });

/* -------------------------------------------------------- notifications */

const PROMO_STORES_LIMIT = 40;

export const notificationsFeed = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const email = context.user.email;
    const [orders, existing, stores, riders] = await Promise.all([
      rows(await db.entities.Order.filter({ customer_email: email }, { sort: "-created_date", limit: 25 })),
      rows(await db.entities.Notification.filter({ user_email: email }, { sort: "-created_date", limit: 120 })),
      db.entities.Store.filter({ is_approved: true, promo: { $exists: true } }, { limit: PROMO_STORES_LIMIT }),
      db.entities.RiderProfile.filter({ user_email: email }),
    ]);

    const known = new Set(existing.map((row) => row.key));
    const pending = [];
    const push = (key, payload) => {
      if (!key || known.has(key)) return;
      known.add(key);
      pending.push({ ...payload, user_email: email, key, is_read: false });
    };

    for (const order of orders) {
      for (const entry of order.timeline ?? []) {
        if (entry.status === "placed") continue;
        const at = entry.at ?? order.updated_date;
        push(`${order.id}:${entry.status}:${at}`, {
          kind: "order",
          title: `${ORDER_STATUS[entry.status]?.label ?? entry.status} · ${order.store_name}`,
          body: entry.note || `Order ${order.code} is now ${String(entry.status).replace(/_/g, " ")}.`,
          link: `/order-details?id=${order.id}`,
          order_code: order.code,
        });
      }
    }

    for (const store of rows(stores).filter((store) => store.promo)) {
      push(`promo:${store.id}:${store.promo}`, {
        kind: "promo",
        title: `${store.name} — ${store.promo}`,
        body: `A live offer from ${store.name}. Tap to browse their menu.`,
        link: `/store-menu?id=${store.id}`,
      });
    }

    const rider = riders[0];
    if (rider && rider.status !== "approved") {
      push(`account:rider:${rider.status}`, {
        kind: "account",
        title: `Rider account ${rider.status}`,
        body:
          rider.status === "pending"
            ? "Your rider application is under review. We will notify you once it is approved."
            : `Your rider account is ${rider.status}. Check your profile for the reviewer's note.`,
        link: "/rider-profile",
      });
    }

    if (pending.length) await db.entities.Notification.bulkCreate(pending.slice(0, 60));

    const all = rows(await db.entities.Notification.filter({ user_email: email }, { sort: "-created_date", limit: 80 }));
    return {
      notifications: all,
      unread: all.filter((row) => !row.is_read).length,
    };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const record = await db.entities.Notification.get(data.id);
    if (record.user_email !== context.user.email) {
      throw Object.assign(new Error("You cannot change this notification."), { status: 403 });
    }
    return db.entities.Notification.update(data.id, { is_read: true });
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const mine = rows(await db.entities.Notification.filter({ user_email: context.user.email, is_read: false }));
    if (mine.length) {
      await db.entities.Notification.bulkUpdate(mine.map((row) => ({ id: row.id, is_read: true })));
    }
    return { updated: mine.length };
  });

/* --------------------------------------------------------- rider schedule */

export const riderShifts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const [shifts, riders] = await Promise.all([
      db.entities.RiderShift.filter({ user_email: context.user.email }, { sort: "date", limit: 80 }),
      db.entities.RiderProfile.filter({ user_email: context.user.email }),
    ]);
    return { shifts, rider: riders[0] ?? null };
  });

export const addRiderShift = createServerFn({ method: "POST" })
  .validator(
    z.object({
      date: z.string().min(10).max(10),
      start_time: z.string().min(4).max(5),
      end_time: z.string().min(4).max(5),
      zone: z.string().max(80).optional(),
      note: z.string().max(160).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider) throw Object.assign(new Error("Submit a rider application first."), { status: 403 });

    const clash = rows(
      await db.entities.RiderShift.filter({ user_email: context.user.email, date: data.date })
    ).some((shift) => shift.start_time === data.start_time);
    if (clash) throw Object.assign(new Error("You already have a shift starting at that time."), { status: 409 });

    return db.entities.RiderShift.create({
      ...data,
      user_email: context.user.email,
      rider_name: rider.full_name,
      zone: data.zone || rider.zone || "",
      status: "planned",
    });
  });

export const removeRiderShift = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const shift = await db.entities.RiderShift.get(data.id);
    if (shift.user_email !== context.user.email) {
      throw Object.assign(new Error("You cannot remove this shift."), { status: 403 });
    }
    await db.entities.RiderShift.delete(data.id);
    return { ok: true };
  });

/* ----------------------------------------------------------- rider docs */

export const saveRiderDocuments = createServerFn({ method: "POST" })
  .validator(
    z.object({
      full_name: z.string().min(2).max(120).optional(),
      phone: z.string().max(40).optional(),
      vehicle_type: z.enum(["bike", "bicycle", "car", "van"]).optional(),
      plate_number: z.string().max(40).optional(),
      id_type: z.string().max(40).optional(),
      id_number: z.string().max(60).optional(),
      id_document_uri: z.string().max(500).optional(),
      license_uri: z.string().max(500).optional(),
      vehicle_doc_uri: z.string().max(500).optional(),
      insurance_uri: z.string().max(500).optional(),
      insurance_expiry: z.string().max(20).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider) throw Object.assign(new Error("Submit a rider application first."), { status: 403 });
    const hasDocs = ["id_document_uri", "license_uri", "vehicle_doc_uri", "insurance_uri"].some(
      (key) => data[key]
    );
    return db.entities.RiderProfile.update(rider.id, {
      ...data,
      docs_status: hasDocs ? "submitted" : rider.docs_status ?? "missing",
      docs_submitted_at: hasDocs ? new Date().toISOString() : rider.docs_submitted_at,
    });
  });

/* --------------------------------------------------------- site content */

const contentFields = (record) => ({
  id: record?.id ?? null,
  announcement_title: record?.announcement_title ?? "",
  announcement_body: record?.announcement_body ?? "",
  announcement_tone: record?.announcement_tone ?? "purple",
  announcement_active: record?.announcement_active ?? false,
  banners: record?.banners ?? [],
  featured_categories: record?.featured_categories ?? [],
});

export const getSiteContent = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const records = await svc(context).entities.PlatformContent.list("-updated_date", 1);
  return contentFields(records[0]);
});

export const saveSiteContent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      announcement_title: z.string().max(120).optional(),
      announcement_body: z.string().max(400).optional(),
      announcement_tone: z.enum(["purple", "orange", "green"]).optional(),
      announcement_active: z.boolean().optional(),
      banners: z
        .array(
          z.object({
            title: z.string().max(80),
            body: z.string().max(200).optional(),
            image_url: z.string().max(500).optional(),
            link: z.string().max(200).optional(),
            is_active: z.boolean().optional(),
          })
        )
        .max(8)
        .optional(),
      featured_categories: z
        .array(
          z.object({
            label: z.string().max(40),
            emoji: z.string().max(8).optional(),
            tint: z.string().max(40).optional(),
          })
        )
        .max(10)
        .optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await requireStaff(context, ["admin"]);
    const db = svc(context);
    const existing = (await db.entities.PlatformContent.list("-updated_date", 1))[0];
    const payload = { ...data, updated_by: context.user.email };
    const saved = existing
      ? await db.entities.PlatformContent.update(existing.id, payload)
      : await db.entities.PlatformContent.create(payload);
    await db.entities.AuditLog.create({
      actor_email: context.user.email,
      action: "content.updated",
      target: "homepage",
      detail: `Homepage content updated (${data.banners?.length ?? 0} banners, ${data.featured_categories?.length ?? 0} categories)`,
      severity: "info",
    });
    return saved;
  });