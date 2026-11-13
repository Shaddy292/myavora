import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

// Used until an admin saves their own numbers in Platform settings.
export const FEE_FALLBACKS = { vendorPct: 10, riderPct: 10, joinFee: 30000, monthlyFee: 2000 };

export const periodOf = (date = new Date()) => new Date(date).toISOString().slice(0, 7);

const monthEnd = (period) => {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};

const shortId = (id, size) => String(id ?? "").slice(-size).toUpperCase();

/* --------------------------------------------------------------- settings */

export async function loadFees(db) {
  const [setting] = rows(await db.entities.PlatformSetting.list("-created_date", 1));
  return {
    vendorPct: setting?.vendor_commission_pct ?? FEE_FALLBACKS.vendorPct,
    riderPct: setting?.rider_commission_pct ?? FEE_FALLBACKS.riderPct,
    joinFee: setting?.vendor_join_fee ?? FEE_FALLBACKS.joinFee,
    monthlyFee: setting?.vendor_monthly_fee ?? FEE_FALLBACKS.monthlyFee,
  };
}

async function staffRole(ctx) {
  if (ctx.user.role === "admin") return "admin";
  const staff = rows(
    await svc(ctx).entities.StaffMember.filter({ email: ctx.user.email, is_active: true })
  )[0];
  return staff?.role ?? "customer";
}

async function allowMoney(ctx) {
  const role = await staffRole(ctx);
  if (!["admin", "finance"].includes(role)) {
    throw Object.assign(new Error("You do not have permission to manage vendor fees."), { status: 403 });
  }
}

const audit = (db, actor, action, target, detail, severity = "info") =>
  db.entities.AuditLog.create({ actor_email: actor.email, action, target, detail, severity });

/* --------------------------------------------------------- charge register */

const joinCharge = (db, store, fees) =>
  db.entities.VendorCharge.create({
    store_id: store.id,
    store_name: store.name,
    owner_email: store.owner_email,
    kind: "join_fee",
    amount: fees.joinFee,
    status: "due",
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    reference: `JOIN-${shortId(store.id, 5)}`,
    note: "One-off vendor registration fee",
  });

const monthCharge = (db, store, fees, period) =>
  db.entities.VendorCharge.create({
    store_id: store.id,
    store_name: store.name,
    owner_email: store.owner_email,
    kind: "subscription",
    period,
    amount: fees.monthlyFee,
    status: "due",
    due_date: monthEnd(period),
    reference: `SUB-${period}-${shortId(store.id, 4)}`,
    note: `${period} platform subscription`,
  });

/**
 * Idempotent billing sweep: raises the one-off joining fee for a vendor that
 * does not have one yet, and the monthly subscription for every live vendor
 * that has not been billed for the current month.
 */
export async function ensureVendorCharges(db) {
  const fees = await loadFees(db);
  const period = periodOf();
  const [stores, existing] = await Promise.all([
    db.entities.Store.list("-created_date", 200),
    db.entities.VendorCharge.list("-created_date", 500),
  ]);
  const charges = rows(existing);
  const created = [];

  for (const store of rows(stores)) {
    if (!store.owner_email || store.review_note === "Rejected") continue;
    const mine = charges.filter((charge) => charge.store_id === store.id);

    if (!mine.some((charge) => charge.kind === "join_fee")) {
      created.push(await joinCharge(db, store, fees));
    }

    const joinPaid =
      !!store.join_fee_paid ||
      mine.some((charge) => charge.kind === "join_fee" && charge.status === "paid");
    const billedThisMonth = mine.some(
      (charge) => charge.kind === "subscription" && charge.period === period
    );
    if (store.is_approved && joinPaid && !billedThisMonth) {
      created.push(await monthCharge(db, store, fees, period));
    }
  }
  return created;
}

/* ------------------------------------------------------------ admin board */

export const vendorFeeBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allowMoney(context);
    const db = svc(context);
    const fees = await loadFees(db);
    const generated = await ensureVendorCharges(db);
    const period = periodOf();
    const [charges, stores] = await Promise.all([
      db.entities.VendorCharge.list("-created_date", 200),
      db.entities.Store.list("-created_date", 200),
    ]);

    const list = rows(charges);
    const storeList = rows(stores);
    const due = list.filter((charge) => charge.status === "due");
    const paidJoin = list.filter((charge) => charge.kind === "join_fee" && charge.status === "paid");
    const paidSub = list.filter(
      (charge) => charge.kind === "subscription" && charge.status === "paid"
    );
    const billable = storeList.filter((store) => store.is_approved && store.join_fee_paid);
    const sum = (items) => items.reduce((total, item) => total + (item.amount || 0), 0);

    return {
      fees,
      period,
      charges: list.slice(0, 40),
      generated: generated.length,
      totals: {
        joinCollected: sum(paidJoin),
        subCollected: sum(paidSub),
        outstanding: sum(due),
        pendingJoin: sum(due.filter((charge) => charge.kind === "join_fee")),
        pendingSub: sum(due.filter((charge) => charge.kind === "subscription")),
        mrr: billable.length * fees.monthlyFee,
        vendors: storeList.filter((store) => store.is_approved).length,
        awaitingFee: storeList.filter((store) => !store.join_fee_paid).length,
      },
    };
  });

export const runVendorBilling = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await allowMoney(context);
    const db = svc(context);
    const created = await ensureVendorCharges(db);
    await audit(
      db,
      context.user,
      "vendor.billing.run",
      periodOf(),
      `${created.length} vendor charges raised for ${periodOf()}`,
      "info"
    );
    return { period: periodOf(), created: created.length };
  });

async function markChargePaid(db, charge, actor) {
  if (charge.status === "paid") return charge;
  const paid = await db.entities.VendorCharge.update(charge.id, {
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  if (charge.kind === "join_fee" && charge.store_id) {
    await db.entities.Store.update(charge.store_id, {
      join_fee_paid: true,
      join_fee_paid_at: paid.paid_at,
      subscription_status: "active",
    });
  }

  await audit(
    db,
    actor,
    `vendor.${charge.kind}.paid`,
    charge.store_name || charge.store_id,
    `${charge.kind === "join_fee" ? "Joining fee" : `${charge.period} subscription`} of ₦${charge.amount} recorded as paid`,
    "info"
  );
  return paid;
}

export const recordVendorChargePaid = createServerFn({ method: "POST" })
  .validator(z.object({ charge_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allowMoney(context);
    const db = svc(context);
    return markChargePaid(db, await db.entities.VendorCharge.get(data.charge_id), context.user);
  });

/** Used by ops while vetting a store: the joining fee is part of onboarding. */
export const recordStoreJoinFee = createServerFn({ method: "POST" })
  .validator(z.object({ store_id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const role = await staffRole(context);
    if (!["admin", "finance", "ops"].includes(role)) {
      throw Object.assign(new Error("You do not have permission to record vendor fees."), {
        status: 403,
      });
    }
    const db = svc(context);
    const store = await db.entities.Store.get(data.store_id);
    const fees = await loadFees(db);
    const existing = rows(
      await db.entities.VendorCharge.filter({ store_id: store.id, kind: "join_fee" })
    )[0];
    const charge = existing ?? (await joinCharge(db, store, fees));
    return markChargePaid(db, charge, context.user);
  });

export const waiveVendorCharge = createServerFn({ method: "POST" })
  .validator(z.object({ charge_id: z.string(), reason: z.string().max(300).optional() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    await allowMoney(context);
    const db = svc(context);
    const charge = await db.entities.VendorCharge.get(data.charge_id);
    const waived = await db.entities.VendorCharge.update(data.charge_id, {
      status: "waived",
      note: data.reason?.trim() || charge.note,
    });

    if (charge.kind === "join_fee" && charge.store_id) {
      await db.entities.Store.update(charge.store_id, {
        join_fee_paid: true,
        join_fee_paid_at: new Date().toISOString(),
      });
    }

    await audit(
      db,
      context.user,
      `vendor.${charge.kind}.waived`,
      charge.store_name || charge.store_id,
      `${charge.kind === "join_fee" ? "Joining fee" : "Subscription"} of ₦${charge.amount} waived — ${data.reason || "no reason given"}`,
      "warning"
    );
    return waived;
  });

/* --------------------------------------------------------- vendor statement */

export const vendorFeeSummary = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const fees = await loadFees(db);
    const store = (await db.entities.Store.filter({ owner_email: context.user.email }))[0];
    if (!store) return { fees, store: null, charges: [], due: 0, joinPaid: false };

    let charges = rows(
      await db.entities.VendorCharge.filter(
        { store_id: store.id },
        { sort: "-created_date", limit: 40 }
      )
    );
    if (!charges.some((charge) => charge.kind === "join_fee")) {
      await joinCharge(db, store, fees);
      charges = rows(
        await db.entities.VendorCharge.filter(
          { store_id: store.id },
          { sort: "-created_date", limit: 40 }
        )
      );
    }

    return {
      fees,
      store,
      charges,
      due: charges
        .filter((charge) => charge.status === "due")
        .reduce((total, charge) => total + (charge.amount || 0), 0),
      joinPaid:
        !!store.join_fee_paid ||
        charges.some((charge) => charge.kind === "join_fee" && charge.status === "paid"),
    };
  });