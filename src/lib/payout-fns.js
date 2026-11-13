import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);
const SUBJECT = z.enum(["rider", "vendor"]);

async function staffRole(ctx) {
  if (ctx.user.role === "admin") return "admin";
  const staff = rows(await svc(ctx).entities.StaffMember.filter({ email: ctx.user.email, is_active: true }));
  return staff[0]?.role ?? "customer";
}

const monthKeys = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return d.toISOString().slice(0, 7);
  });
};

// Rider payouts paid out per calendar month, split per rider (one stacked series each).
export const riderMonthlyPayouts = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const role = await staffRole(context);
    if (!["admin", "ops", "finance"].includes(role)) {
      throw Object.assign(new Error("You do not have permission to open this area."), { status: 403 });
    }
    const db = svc(context);
    const orders = rows(await db.entities.Order.list("-created_date", 500));
    const keys = monthKeys();
    const byRider = new Map();

    orders
      .filter((order) => order.status === "delivered" && order.rider_email)
      .forEach((order) => {
        const key = String(order.delivered_at || order.created_date || "").slice(0, 7);
        if (!keys.includes(key)) return;
        const amount = order.rider_payout || 0;
        const entry = byRider.get(order.rider_email) ?? {
          name: order.rider_name || order.rider_email,
          total: 0,
          amounts: {},
        };
        entry.total += amount;
        entry.amounts[key] = (entry.amounts[key] || 0) + amount;
        byRider.set(order.rider_email, entry);
      });

    const sorted = [...byRider.values()].sort((a, b) => b.total - a.total);
    const series = sorted.slice(0, 5).map((entry, index) => ({
      key: `r${index}`,
      name: entry.name,
      total: entry.total,
      amounts: entry.amounts,
    }));

    const rest = sorted.slice(5);
    if (rest.length) {
      const amounts = {};
      rest.forEach((entry) =>
        keys.forEach((key) => {
          if (entry.amounts[key]) amounts[key] = (amounts[key] || 0) + entry.amounts[key];
        })
      );
      series.push({
        key: "others",
        name: `Other riders (${rest.length})`,
        total: rest.reduce((sum, entry) => sum + entry.total, 0),
        amounts,
      });
    }

    const months = keys.map((key) => {
      const row = {
        key,
        label: new Date(`${key}-01T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }),
        total: 0,
      };
      series.forEach((item) => {
        row[item.key] = item.amounts[key] || 0;
        row.total += row[item.key];
      });
      return row;
    });

    return {
      months,
      series: series.map(({ key, name, total }) => ({ key, name, total })),
      grandTotal: months.reduce((sum, row) => sum + row.total, 0),
      riderCount: sorted.length,
    };
  });

/* ------------------------------------------------------- payout account */

export const getMyPayoutAccount = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .validator(z.object({ subject_type: SUBJECT }))
  .handler(async ({ data, context }) => {
    const found = rows(
      await svc(context).entities.PayoutAccount.filter({
        owner_email: context.user.email,
        subject_type: data.subject_type,
      })
    )[0];
    return found ?? null;
  });

export const saveMyPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      subject_type: SUBJECT,
      bank_name: z.string().min(2).max(60),
      account_name: z.string().min(2).max(80),
      account_number: z.string().regex(/^\d{6,20}$/, "Enter a valid account number"),
    })
  )
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const email = context.user.email;
    const payload = {
      owner_email: email,
      subject_type: data.subject_type,
      bank_name: data.bank_name.trim(),
      account_name: data.account_name.trim(),
      account_number: data.account_number.trim(),
      payout_cycle: "daily",
    };

    const existing = rows(
      await db.entities.PayoutAccount.filter({ owner_email: email, subject_type: data.subject_type })
    )[0];

    if (existing) return db.entities.PayoutAccount.update(existing.id, payload);
    return db.entities.PayoutAccount.create({
      ...payload,
      display_name: context.user.full_name || email,
      created_by_id: context.user.id,
    });
  });