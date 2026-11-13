import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { ROLE_PERMISSIONS } from "@/lib/avora";
import { ensureVendorCharges, loadFees } from "@/lib/finance-fns";

const svc = (ctx) => ctx.getDb().asServiceRole;

async function roleOf(ctx) {
  if (ctx.user.role === "admin") return "admin";
  const staff = await svc(ctx).entities.StaffMember.filter({
    email: ctx.user.email,
    is_active: true,
  });
  return staff[0]?.role ?? "customer";
}

async function guard(ctx, permission) {
  const role = await roleOf(ctx);
  if (!(ROLE_PERMISSIONS[role] ?? []).includes(permission)) {
    throw Object.assign(new Error("You do not have permission to open this area."), { status: 403 });
  }
  return role;
}

const audit = (db, actor, action, target, detail, severity = "info") =>
  db.entities.AuditLog.create({
    actor_email: actor.email,
    action,
    target,
    detail,
    severity,
  });

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

/* ---------------------------------------------------------------- context */

export const getConsoleContext = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const role = await roleOf(context);
    const [stores, riders] = await Promise.all([
      db.entities.Store.filter({ owner_email: context.user.email }),
      db.entities.RiderProfile.filter({ user_email: context.user.email }),
    ]);
    return {
      user: {
        id: context.user.id,
        email: context.user.email,
        full_name: context.user.full_name,
        role: context.user.role,
      },
      role,
      permissions: ROLE_PERMISSIONS[role] ?? [],
      store: stores[0] ?? null,
      rider: riders[0] ?? null,
    };
  });

/* ------------------------------------------------------------------ admin */

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "orders.view");
    const db = svc(context);
    const [orders, stores, riders, tickets, refunds] = await Promise.all([
      db.entities.Order.list("-created_date", 200),
      db.entities.Store.list("-created_date", 100),
      db.entities.RiderProfile.list("-created_date", 100),
      db.entities.SupportTicket.list("-created_date", 100),
      db.entities.Refund.list("-created_date", 100),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const active = orders.filter((o) =>
      ["placed", "accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up"].includes(o.status)
    );
    const stale = active.filter(
      (o) => Date.now() - new Date(o.created_date).getTime() > 45 * 60 * 1000
    );

    return {
      gmvToday: orders
        .filter((o) => o.status === "delivered" && dayKey(o.created_date) === today)
        .reduce((s, o) => s + (o.total || 0), 0),
      ordersToday: orders.filter((o) => dayKey(o.created_date) === today).length,
      activeOrders: active.length,
      exceptions: [
        ...orders.filter((o) => ["failed", "cancelled"].includes(o.status)).slice(0, 5),
        ...stale,
      ].slice(0, 6),
      pendingStores: stores.filter((s) => !s.is_approved).length,
      pendingRiders: riders.filter((r) => r.status === "pending").length,
      ridersOnline: riders.filter((r) => r.is_online && r.status === "approved").length,
      openTickets: tickets.filter((t) => t.status !== "closed").length,
      pendingRefunds: refunds.filter((r) => r.status === "requested").length,
      recentOrders: orders.slice(0, 8),
    };
  });

export const adminOrders = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.string().optional() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "orders.view");
    const db = svc(context);
    const rows = data.status
      ? await db.entities.Order.filter({ status: data.status }, { sort: "-created_date", limit: 100 })
      : await db.entities.Order.list("-created_date", 100);
    return Array.isArray(rows) ? rows : rows.items;
  });

export const adminVerifications = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "verification.manage");
    const db = svc(context);
    const [stores, riders, charges] = await Promise.all([
      db.entities.Store.list("-created_date", 100),
      db.entities.RiderProfile.list("-created_date", 100),
      db.entities.VendorCharge.list("-created_date", 300),
    ]);
    const chargeRows = Array.isArray(charges) ? charges : charges.items;
    const withFees = stores.map((store) => ({
      ...store,
      feePaid:
        !!store.join_fee_paid ||
        chargeRows.some(
          (charge) =>
            charge.store_id === store.id && charge.kind === "join_fee" && charge.status === "paid"
        ),
      feeDue: chargeRows
        .filter((charge) => charge.store_id === store.id && charge.status === "due")
        .reduce((total, charge) => total + (charge.amount || 0), 0),
    }));
    return {
      stores: withFees.filter((s) => !s.is_approved),
      approvedStores: withFees.filter((s) => s.is_approved),
      riders: riders.filter((r) => r.status === "pending"),
      reviewedRiders: riders.filter((r) => r.status !== "pending"),
    };
  });

export const reviewStore = createServerFn({ method: "POST" })
  .validator(
    z.object({
      store_id: z.string(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().max(400).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "verification.manage");
    const db = svc(context);
    const approved = data.decision === "approve";
    const current = await db.entities.Store.get(data.store_id);
    if (approved && !current.join_fee_paid) {
      const fees = await loadFees(db);
      throw Object.assign(
        new Error(
          `Collect the ₦${fees.joinFee.toLocaleString("en-NG")} joining and registration fee before approving this vendor. Record it under Finance → Vendor fees.`
        ),
        { status: 409 }
      );
    }
    const store = await db.entities.Store.update(data.store_id, {
      is_approved: approved,
      is_open: approved,
      review_note: data.note ?? (approved ? "Approved" : "Rejected"),
    });
    await audit(
      db,
      context.user,
      approved ? "vendor.approved" : "vendor.rejected",
      store.name,
      `Vendor verification ${data.decision}d by ${context.user.email}`,
      approved ? "info" : "warning"
    );
    return store;
  });

export const reviewRider = createServerFn({ method: "POST" })
  .validator(
    z.object({
      rider_id: z.string(),
      decision: z.enum(["approve", "reject", "suspend"]),
      note: z.string().max(400).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "verification.manage");
    const db = svc(context);
    const status = data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "suspended";
    const rider = await db.entities.RiderProfile.update(data.rider_id, {
      status,
      is_online: status === "approved" ? undefined : false,
      review_note: data.note,
    });
    await audit(
      db,
      context.user,
      `rider.${status}`,
      rider.full_name,
      `Rider verification set to ${status} by ${context.user.email}`,
      status === "approved" ? "info" : "warning"
    );
    return rider;
  });

/* ---------------------------------------------------------------- finance */

export const adminFinance = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "finance.view");
    const db = svc(context);
    const [payments, orders, refunds, settlements, stores] = await Promise.all([
      db.entities.Payment.list("-created_date", 200),
      db.entities.Order.list("-created_date", 200),
      db.entities.Refund.list("-created_date", 100),
      db.entities.Settlement.list("-created_date", 100),
      db.entities.Store.list("-created_date", 100),
    ]);

    const card = payments.filter((p) => p.method === "card" && p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const cash = payments
      .filter((p) => p.method === "cash" && ["paid", "cash_collected"].includes(p.status))
      .reduce((s, p) => s + p.amount, 0);
    const refunded = refunds.filter((r) => ["approved", "processed"].includes(r.status)).reduce((s, r) => s + r.amount, 0);
    const delivered = orders.filter((o) => o.status === "delivered");
    const fees = await loadFees(db);
    const vendorCommission = delivered.reduce((s, o) => {
      const rate = stores.find((st) => st.id === o.store_id)?.commission_rate ?? fees.vendorPct / 100;
      return s + Math.round((o.subtotal || 0) * rate);
    }, 0);
    const riderCommission = delivered.reduce(
      (s, o) => s + Math.round((o.delivery_fee || 0) * (fees.riderPct / 100)),
      0
    );

    return {
      card,
      cash,
      refunded,
      fees,
      vendorCommission,
      riderCommission,
      commission: vendorCommission + riderCommission,
      deliveredRevenue: delivered.reduce((s, o) => s + (o.total || 0), 0),
      payoutsPending: settlements.filter((s) => s.status === "pending").reduce((s, x) => s + x.net, 0),
      mismatches: delivered.filter((o) => o.payment_status !== "paid" && !o.cash_collected),
      payments: payments.slice(0, 40),
      refunds: refunds.filter((r) => r.status === "requested"),
      allRefunds: refunds.slice(0, 20),
      settlements: settlements.slice(0, 40),
    };
  });

export const decideRefund = createServerFn({ method: "POST" })
  .validator(
    z.object({
      refund_id: z.string(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().max(400).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "finance.manage");
    const db = svc(context);
    const refund = await db.entities.Refund.get(data.refund_id);
    const approved = data.decision === "approve";

    await db.entities.Refund.update(data.refund_id, {
      status: approved ? "processed" : "rejected",
      decided_by: context.user.email,
      note: data.note,
    });

    if (approved) {
      if (refund.order_id) {
        await db.entities.Order.update(refund.order_id, { payment_status: "refunded" });
        const payments = await db.entities.Payment.filter({ order_id: refund.order_id });
        if (payments[0]) {
          await db.entities.Payment.update(payments[0].id, { status: "refunded", note: `Refund ${data.refund_id}` });
        }
      }
      await audit(
        db,
        context.user,
        "refund.processed",
        refund.order_code || refund.order_id,
        `Refund of ₦${refund.amount} approved by ${context.user.email}`,
        "warning"
      );
    } else {
      await audit(db, context.user, "refund.rejected", refund.order_code || refund.order_id, data.note ?? "Rejected", "info");
    }
    return { ok: true };
  });

export const runSettlements = createServerFn({ method: "POST" })
  .validator(z.object({ days: z.number().min(1).max(90).default(7) }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "finance.manage");
    const db = svc(context);
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const orders = (await db.entities.Order.list("-created_date", 300)).filter(
      (o) => o.status === "delivered" && o.created_date >= since
    );
    const stores = await db.entities.Store.list("-created_date", 100);
    const fees = await loadFees(db);
    await ensureVendorCharges(db);
    const chargeRows = await db.entities.VendorCharge.list("-created_date", 400);
    const openCharges = (Array.isArray(chargeRows) ? chargeRows : chargeRows.items).filter(
      (charge) => charge.status === "due"
    );

    const vendorBuckets = new Map();
    const riderBuckets = new Map();
    for (const order of orders) {
      if (order.owner_email) {
        const bucket = vendorBuckets.get(order.owner_email) ?? {
          name: order.store_name,
          orders: 0,
          gross: 0,
        };
        bucket.orders += 1;
        bucket.gross += order.subtotal || 0;
        vendorBuckets.set(order.owner_email, bucket);
      }
      if (order.rider_email) {
        const bucket = riderBuckets.get(order.rider_email) ?? {
          name: order.rider_name,
          orders: 0,
          gross: 0,
        };
        bucket.orders += 1;
        bucket.gross += order.delivery_fee || 0;
        riderBuckets.set(order.rider_email, bucket);
      }
    }

    const created = [];
    for (const [email, bucket] of vendorBuckets) {
      const rate = stores.find((s) => s.owner_email === email)?.commission_rate ?? fees.vendorPct / 100;
      const commission = Math.round(bucket.gross * rate);

      // The joining fee and the monthly subscription are taken out of the payout.
      const owed = openCharges
        .filter((charge) => charge.owner_email === email)
        .sort((a, b) => (a.kind === "join_fee" ? 0 : 1) - (b.kind === "join_fee" ? 0 : 1));
      let remaining = bucket.gross - commission;
      let deductions = 0;
      const cleared = [];
      for (const charge of owed) {
        if ((charge.amount || 0) > remaining) continue;
        remaining -= charge.amount;
        deductions += charge.amount;
        cleared.push(charge);
      }

      const reference = `STM-${Date.now().toString().slice(-6)}`;
      const settlement = await db.entities.Settlement.create({
        subject_type: "vendor",
        subject_email: email,
        subject_name: bucket.name,
        period_start: since.slice(0, 10),
        period_end: new Date().toISOString().slice(0, 10),
        orders_count: bucket.orders,
        gross: bucket.gross,
        commission,
        deductions,
        net: remaining,
        status: "pending",
        reference,
        notes: cleared.length
          ? `Deducted ${cleared.map((charge) => charge.reference).join(", ")}`
          : "",
      });
      created.push(settlement);

      for (const charge of cleared) {
        await db.entities.VendorCharge.update(charge.id, {
          status: "paid",
          paid_at: new Date().toISOString(),
          settlement_id: settlement.id,
          note: `Deducted from settlement ${reference}`,
        });
      }
    }
    for (const [email, bucket] of riderBuckets) {
      const commission = Math.round(bucket.gross * (fees.riderPct / 100));
      created.push(
        await db.entities.Settlement.create({
          subject_type: "rider",
          subject_email: email,
          subject_name: bucket.name,
          period_start: since.slice(0, 10),
          period_end: new Date().toISOString().slice(0, 10),
          orders_count: bucket.orders,
          gross: bucket.gross,
          commission,
          deductions: 0,
          net: bucket.gross - commission,
          status: "pending",
          reference: `STM-${Date.now().toString().slice(-6)}`,
        })
      );
    }
    await audit(db, context.user, "settlements.generated", `${created.length} statements`, `Last ${data.days} days`);
    return created;
  });

export const markSettlementPaid = createServerFn({ method: "POST" })
  .validator(z.object({ settlement_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "finance.manage");
    const db = svc(context);
    const updated = await db.entities.Settlement.update(data.settlement_id, { status: "paid" });
    await audit(db, context.user, "settlement.paid", updated.subject_name, `₦${updated.net} paid out`, "info");
    return updated;
  });

/* ---------------------------------------------------------------- reports */

export const adminReports = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "reports.view");
    const db = svc(context);
    const [orders, riders, auditLogs] = await Promise.all([
      db.entities.Order.list("-created_date", 300),
      db.entities.RiderProfile.list("-created_date", 100),
      db.entities.AuditLog.list("-created_date", 40),
    ]);

    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter((o) => dayKey(o.created_date) === key);
      days.push({
        date: key.slice(5),
        orders: dayOrders.length,
        gmv: dayOrders.filter((o) => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0),
      });
    }

    const storeMap = new Map();
    for (const o of orders) {
      const bucket = storeMap.get(o.store_name) ?? { name: o.store_name, orders: 0, gmv: 0 };
      bucket.orders += 1;
      bucket.gmv += o.total || 0;
      storeMap.set(o.store_name, bucket);
    }

    return {
      days,
      topStores: [...storeMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 6),
      riders: riders
        .map((r) => ({
          name: r.full_name,
          deliveries: r.deliveries_count || 0,
          rating: r.rating ?? 5,
          online: !!r.is_online,
          status: r.status,
          cash: r.cash_on_hand || 0,
        }))
        .sort((a, b) => b.deliveries - a.deliveries)
        .slice(0, 8),
      auditLogs,
      backups: auditLogs.filter((l) => l.action === "backup.run"),
      critical: auditLogs.filter((l) => l.severity === "critical").length,
    };
  });

export const adminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "reports.view");
    const db = svc(context);
    const [orders, stores, riders] = await Promise.all([
      db.entities.Order.list("-created_date", 400),
      db.entities.Store.list("-created_date", 100),
      db.entities.RiderProfile.list("-created_date", 100),
    ]);

    const dayKeyOf = (value) => new Date(value).toISOString().slice(0, 10);
    const monthKeyOf = (value) => new Date(value).toISOString().slice(0, 7);
    const delivered = orders.filter((order) => order.status === "delivered");
    const live = orders.filter((order) =>
      ["placed", "accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up"].includes(order.status)
    );

    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = dayKeyOf(date);
      const dayOrders = orders.filter((order) => dayKeyOf(order.created_date) === key);
      days.push({
        date: key.slice(5),
        orders: dayOrders.length,
        gmv: dayOrders
          .filter((order) => order.status === "delivered")
          .reduce((sum, order) => sum + (order.total || 0), 0),
      });
    }

    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      const key = monthKeyOf(date);
      const monthOrders = orders.filter((order) => monthKeyOf(order.created_date) === key);
      months.push({
        key,
        month: date.toLocaleString("en-GB", { month: "short" }),
        orders: monthOrders.length,
        gmv: monthOrders
          .filter((order) => order.status === "delivered")
          .reduce((sum, order) => sum + (order.total || 0), 0),
      });
    }

    const firstSeen = new Map();
    for (const order of [...orders].reverse()) {
      if (order.customer_email && !firstSeen.has(order.customer_email)) {
        firstSeen.set(order.customer_email, monthKeyOf(order.created_date));
      }
    }
    months.forEach((bucket) => {
      bucket.customers = [...firstSeen.values()].filter((key) => key === bucket.key).length;
    });

    const statusMap = new Map();
    for (const order of orders) statusMap.set(order.status, (statusMap.get(order.status) ?? 0) + 1);

    const storeMap = new Map();
    for (const order of orders) {
      const bucket = storeMap.get(order.store_name) ?? { name: order.store_name, orders: 0, gmv: 0 };
      bucket.orders += 1;
      bucket.gmv += order.total || 0;
      storeMap.set(order.store_name, bucket);
    }

    const gmv = delivered.reduce((sum, order) => sum + (order.total || 0), 0);

    return {
      totals: {
        gmv,
        orders: orders.length,
        active: live.length,
        customers: firstSeen.size,
        stores: stores.filter((store) => store.is_approved).length,
        ridersOnline: riders.filter((rider) => rider.is_online && rider.status === "approved").length,
        avgOrder: delivered.length ? Math.round(gmv / delivered.length) : 0,
      },
      days,
      months,
      statusMix: [...statusMap.entries()].map(([status, count]) => ({ status, count })),
      topStores: [...storeMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 6),
    };
  });

export const runBackup = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "backup.run");
    const db = svc(context);
    const [orders, stores, products, riders, payments] = await Promise.all([
      db.entities.Order.count({}),
      db.entities.Store.count({}),
      db.entities.Product.count({}),
      db.entities.RiderProfile.count({}),
      db.entities.Payment.count({}),
    ]);
    const snapshot = { at: new Date().toISOString(), orders, stores, products, riders, payments };
    await db.entities.AuditLog.create({
      actor_email: context.user.email,
      action: "backup.run",
      target: "full-snapshot",
      detail: JSON.stringify(snapshot),
      severity: "info",
    });
    return snapshot;
  });

/* ------------------------------------------------------------ order flow */

const TRANSITIONS = {
  accept: { from: ["placed"], to: "accepted", actor: "vendor" },
  reject: { from: ["placed", "accepted"], to: "cancelled", actor: "vendor" },
  preparing: { from: ["accepted"], to: "preparing", actor: "vendor" },
  ready: { from: ["preparing"], to: "ready_for_pickup", actor: "vendor" },
  pickup: { from: ["rider_assigned", "ready_for_pickup"], to: "picked_up", actor: "rider" },
  deliver: { from: ["picked_up"], to: "delivered", actor: "rider" },
  fail: { from: ["picked_up", "rider_assigned"], to: "failed", actor: "rider" },
  cancel: { from: ["placed", "accepted"], to: "cancelled", actor: "customer" },
};

export const advanceOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      order_id: z.string(),
      action: z.enum(["accept", "reject", "preparing", "ready", "pickup", "deliver", "fail", "cancel"]),
      note: z.string().max(300).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const order = await db.entities.Order.get(data.order_id);
    const rule = TRANSITIONS[data.action];
    if (!rule) throw Object.assign(new Error("Unknown action"), { status: 400 });
    if (!rule.from.includes(order.status)) {
      throw Object.assign(new Error(`This order is ${order.status} and can no longer be ${data.action}ed.`), {
        status: 409,
      });
    }

    const email = context.user.email;
    const isAdmin = context.user.role === "admin" || (await roleOf(context)) === "ops";
    const allowed =
      isAdmin ||
      (rule.actor === "vendor" && order.owner_email === email) ||
      (rule.actor === "rider" && order.rider_email === email) ||
      (rule.actor === "customer" && order.customer_email === email);
    if (!allowed) throw Object.assign(new Error("You cannot update this order."), { status: 403 });

    const timeline = [
      ...(order.timeline ?? []),
      { status: rule.to, at: new Date().toISOString(), note: data.note ?? "", by: email },
    ];
    const patch = { status: rule.to, timeline };

    if (data.action === "reject" || data.action === "cancel") {
      patch.cancel_reason = data.note ?? "Cancelled";
      if (order.payment_status === "paid") patch.payment_status = "refunded";
    }
    if (data.action === "deliver") {
      patch.delivered_at = new Date().toISOString();
      patch.payment_status = "paid";
      if (order.payment_method === "cash") patch.cash_collected = true;
      const riders = await db.entities.RiderProfile.filter({ user_email: order.rider_email });
      if (riders[0]) {
        await db.entities.RiderProfile.update(riders[0].id, {
          deliveries_count: (riders[0].deliveries_count || 0) + 1,
          cash_on_hand: (riders[0].cash_on_hand || 0) + (order.payment_method === "cash" ? order.total || 0 : 0),
        });
      }
    }
    if (data.action === "fail") {
      patch.failure_reason = data.note ?? "Delivery failed";
      if (order.payment_status === "paid") patch.payment_status = "refunded";
    }

    const updated = await db.entities.Order.update(data.order_id, patch);
    await audit(
      db,
      context.user,
      `order.${rule.to}`,
      order.code,
      data.note ? `${data.note} (${order.code})` : `Order ${order.code} → ${rule.to}`,
      ["fail", "reject", "cancel"].includes(data.action) ? "warning" : "info"
    );
    return updated;
  });

export const claimDelivery = createServerFn({ method: "POST" })
  .validator(z.object({ order_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider || rider.status !== "approved") {
      throw Object.assign(new Error("Your rider account is not approved yet."), { status: 403 });
    }
    const order = await db.entities.Order.get(data.order_id);
    if (order.rider_email && order.rider_email !== context.user.email) {
      throw Object.assign(new Error("Another rider already accepted this job."), { status: 409 });
    }
    if (order.status !== "ready_for_pickup") {
      throw Object.assign(new Error("This order is not ready for pickup yet."), { status: 409 });
    }
    const timeline = [
      ...(order.timeline ?? []),
      { status: "rider_assigned", at: new Date().toISOString(), note: "Rider assigned", by: context.user.email },
    ];
    const fees = await loadFees(db);
    const updated = await db.entities.Order.update(data.order_id, {
      rider_email: context.user.email,
      rider_name: rider.full_name,
      rider_phone: rider.phone,
      rider_payout: Math.round((order.delivery_fee || 400) * (1 - fees.riderPct / 100)),
      status: "rider_assigned",
      timeline,
    });
    await db.entities.RiderProfile.update(rider.id, { is_online: true });
    return updated;
  });

export const availableJobs = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider || rider.status !== "approved") return [];
    const rows = await db.entities.Order.filter({ status: "ready_for_pickup" }, { sort: "created_date", limit: 30 });
    const jobs = rows.items ?? rows;
    return jobs
      .filter((job) => !job.rider_email)
      .map((job) => ({
        id: job.id,
        code: job.code,
        store_name: job.store_name,
        address_area: job.address_area,
        address_line: job.address_line,
        total: job.total,
        delivery_fee: job.delivery_fee,
        created_date: job.created_date,
      }));
  });

export const setRiderOnline = createServerFn({ method: "POST" })
  .validator(z.object({ online: z.boolean() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider) throw Object.assign(new Error("No rider profile found."), { status: 404 });
    if (rider.status !== "approved") {
      throw Object.assign(new Error("Your rider account is still under review."), { status: 403 });
    }
    return db.entities.RiderProfile.update(rider.id, { is_online: data.online });
  });

/* ---------------------------------------------------------------- support */

export const supportQueue = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "support.manage");
    const rows = await svc(context).entities.SupportTicket.list("-created_date", 100);
    return rows;
  });

export const replyTicket = createServerFn({ method: "POST" })
  .validator(z.object({ ticket_id: z.string(), body: z.string().min(2).max(2000) }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const ticket = await db.entities.SupportTicket.get(data.ticket_id);
    const role = await roleOf(context);
    const isStaff = ["admin", "support"].includes(role);
    if (!isStaff && ticket.customer_email !== context.user.email) {
      throw Object.assign(new Error("You cannot reply to this ticket."), { status: 403 });
    }
    const messages = [
      ...(ticket.messages ?? []),
      { from: isStaff ? "AVORA Support" : ticket.customer_name || context.user.email, body: data.body, at: new Date().toISOString() },
    ];
    return db.entities.SupportTicket.update(data.ticket_id, {
      messages,
      status: isStaff ? "answered" : "open",
      assigned_to: isStaff ? context.user.email : ticket.assigned_to,
    });
  });

export const closeTicket = createServerFn({ method: "POST" })
  .validator(z.object({ ticket_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "support.manage");
    return svc(context).entities.SupportTicket.update(data.ticket_id, { status: "closed" });
  });

export const supportTicketBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "support.manage");
    const db = svc(context);
    const [tickets, orders] = await Promise.all([
      db.entities.SupportTicket.list("-created_date", 120),
      db.entities.Order.list("-created_date", 200),
    ]);
    return { tickets, orders };
  });

export const setTicketState = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ticket_id: z.string(),
      status: z.enum(["open", "answered", "closed"]).optional(),
      assigned_to: z.string().max(140).optional(),
      note: z.string().max(1000).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await guard(context, "support.manage");
    const db = svc(context);
    const ticket = await db.entities.SupportTicket.get(data.ticket_id);
    const patch = {};
    if (data.note?.trim()) {
      patch.messages = [
        ...(ticket.messages ?? []),
        { from: "AVORA Support", body: data.note.trim(), at: new Date().toISOString() },
      ];
    }
    if (data.status) patch.status = data.status;
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    if (data.status === "closed" && !patch.assigned_to) {
      patch.assigned_to = ticket.assigned_to || context.user.email;
    }
    const updated = await db.entities.SupportTicket.update(data.ticket_id, patch);
    await audit(
      db,
      context.user,
      `ticket.${data.status ?? "updated"}`,
      ticket.order_code || ticket.topic,
      `Ticket ${data.status ?? "updated"} by ${context.user.email}`,
      data.status === "closed" ? "info" : "warning"
    );
    return updated;
  });

/* -------------------------------------------------------- support dashboard */

const PRIORITY_WEIGHT = { urgent: 0, high: 1, normal: 2 };

export const supportDashboard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await guard(context, "support.manage");
    const db = svc(context);
    const [tickets, refunds, orders] = await Promise.all([
      db.entities.SupportTicket.list("-created_date", 200),
      db.entities.Refund.list("-created_date", 100),
      db.entities.Order.list("-created_date", 200),
    ]);

    const today = dayKey(new Date().toISOString());
    const weekAgo = dayKey(new Date(Date.now() - 7 * 86400000).toISOString());
    const open = tickets.filter((ticket) => ticket.status === "open");
    const queue = [...open].sort(
      (a, b) =>
        (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2) ||
        new Date(a.created_date) - new Date(b.created_date)
    );

    const topics = new Map();
    tickets.forEach((ticket) => {
      const key = ticket.topic?.trim() || "Uncategorised";
      const entry = topics.get(key) ?? { topic: key, total: 0, open: 0 };
      entry.total += 1;
      if (ticket.status === "open") entry.open += 1;
      topics.set(key, entry);
    });

    const disputes = refunds.filter((refund) => refund.status === "requested");
    const troubled = orders.filter((order) => ["cancelled", "failed"].includes(order.status));

    return {
      stats: {
        open: open.length,
        unassigned: open.filter((ticket) => !ticket.assigned_to).length,
        urgent: open.filter((ticket) => ticket.priority === "urgent").length,
        high: open.filter((ticket) => ticket.priority === "high").length,
        clearedToday: tickets.filter((ticket) => ticket.status !== "open" && dayKey(ticket.updated_date) === today).length,
        disputes: disputes.length,
        disputeValue: disputes.reduce((sum, refund) => sum + (refund.amount || 0), 0),
        troubledThisWeek: troubled.filter((order) => dayKey(order.created_date) >= weekAgo).length,
        totalTickets: tickets.length,
      },
      queue: queue.slice(0, 8),
      topics: [...topics.values()].sort((a, b) => b.open - a.open || b.total - a.total).slice(0, 6),
      disputes: disputes.slice(0, 6),
      troubled: troubled.slice(0, 5),
    };
  });

/* ------------------------------------------------------------------ staff */

async function requireAdmin(ctx) {
  const role = await roleOf(ctx);
  if (role !== "admin") {
    throw Object.assign(new Error("Only administrators can manage staff access."), { status: 403 });
  }
}

export const adminStaffBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = svc(context);
    const [staff, users] = await Promise.all([
      db.entities.StaffMember.list("-created_date", 100),
      db.entities.User.list("-created_date", 100),
    ]);
    const rows = users.items ?? users;
    return {
      staff,
      members: rows
        .filter((row) => row.email !== context.user.email)
        .map((row) => ({ email: row.email, full_name: row.full_name, role: row.role })),
      me: context.user.email,
    };
  });

export const saveStaffMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      email: z.string().email(),
      full_name: z.string().max(120).optional(),
      role: z.enum(["admin", "ops", "finance", "support"]),
      is_active: z.boolean().default(true),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = svc(context);
    const { id, ...record } = data;
    const saved = id
      ? await db.entities.StaffMember.update(id, record)
      : await db.entities.StaffMember.create(record);
    await audit(
      db,
      context.user,
      id ? "staff.updated" : "staff.added",
      record.email,
      `${record.email} set to ${record.role}${record.is_active ? "" : " (suspended)"}`,
      "warning"
    );
    return saved;
  });

export const removeStaffMember = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const db = svc(context);
    const staff = await db.entities.StaffMember.get(data.id);
    await db.entities.StaffMember.delete(data.id);
    await audit(db, context.user, "staff.removed", staff.email, `${staff.role} access removed`, "critical");
    return { ok: true };
  });