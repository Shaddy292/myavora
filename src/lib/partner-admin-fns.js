import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

const requireAdmin = (context) => {
  if (context.user.role !== "admin") {
    throw Object.assign(new Error("Only administrators can manage partners."), { status: 403 });
  }
};

/* ---------------------------------------------------------------- vendors */

export const adminVendorBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    requireAdmin(context);
    const stores = rows(await svc(context).entities.Store.list("-created_date", 200));
    return { stores };
  });

export const adminUpdateVendor = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      store_id: z.string(),
      is_open: z.boolean().optional(),
      commission_rate: z.number().min(0).max(0.9).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context);
    const { store_id, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
    if (Object.keys(patch).length === 0) return { ok: true };
    return svc(context).entities.Store.update(store_id, patch);
  });

/* ----------------------------------------------------------------- riders */

export const adminRiderBoard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    requireAdmin(context);
    const riders = rows(await svc(context).entities.RiderProfile.list("-created_date", 200));
    return { riders };
  });

export const adminSetRiderDocs = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      rider_id: z.string(),
      docs_status: z.enum(["missing", "submitted", "verified", "rejected"]),
    })
  )
  .handler(async ({ data, context }) => {
    requireAdmin(context);
    return svc(context).entities.RiderProfile.update(data.rider_id, { docs_status: data.docs_status });
  });