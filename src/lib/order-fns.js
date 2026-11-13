import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { promoDiscount, promoProblem } from "@/lib/promo";
import { loadFees } from "@/lib/finance-fns";

const svc = (ctx) => ctx.getDb().asServiceRole;
const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

/* ------------------------------------------------------- customer orders */

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    rows(
      await svc(context).entities.Order.filter(
        { customer_email: context.user.email },
        { sort: "-created_date", limit: 60 }
      )
    )
  );

export const getMyOrder = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const order = await svc(context)
      .entities.Order.get(data.id)
      .catch((error) => {
        if (error?.status === 404) return null;
        throw error;
      });
    if (!order) return null;
    const email = context.user.email;
    const allowed =
      context.user.role === "admin" ||
      [order.customer_email, order.owner_email, order.rider_email].includes(email);
    if (!allowed) throw Object.assign(new Error("You cannot open this order."), { status: 403 });
    return order;
  });

export const placeOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      items: z
        .array(z.object({ product_id: z.string().min(1), qty: z.number().int().min(1).max(50) }))
        .min(1)
        .max(40),
      address_label: z.string().max(60).optional(),
      address_line: z.string().min(3).max(200),
      address_area: z.string().max(80).optional(),
      address_phone: z.string().max(40).optional(),
      payment_method: z.enum(["cash", "card"]),
      notes: z.string().max(300).optional(),
      promo_code: z.string().max(30).optional(),
    })
  )
  .middleware([requireUser])
  .handler(async ({ data, context }) => {
    const db = svc(context);
    const ids = [...new Set(data.items.map((item) => item.product_id))];
    const products = rows(await db.entities.Product.filter({ id: { $in: ids } }));
    const priced = data.items
      .map((line) => {
        const product = products.find((row) => row.id === line.product_id);
        if (!product || product.is_available === false) return null;
        return {
          product_id: product.id,
          name: product.name,
          qty: line.qty,
          unit_price: product.price || 0,
          options: [],
          store_id: product.store_id,
        };
      })
      .filter(Boolean);

    if (!priced.length) throw Object.assign(new Error("Those items are no longer available."), { status: 409 });
    if (new Set(priced.map((line) => line.store_id)).size > 1) {
      throw Object.assign(new Error("Your basket can only hold items from one store."), { status: 409 });
    }

    const store = await db.entities.Store.get(priced[0].store_id);
    const subtotal = priced.reduce((sum, line) => sum + line.unit_price * line.qty, 0);
    const deliveryFee = store?.delivery_fee ?? 500;
    const serviceFee = Math.round(subtotal * 0.05);

    const promo = data.promo_code
      ? rows(await db.entities.PromoCode.filter({ code: data.promo_code.trim().toUpperCase() }))[0]
      : null;
    let discount = 0;
    if (data.promo_code) {
      const problem = promoProblem(promo, subtotal, store?.id);
      if (problem) throw Object.assign(new Error(problem), { status: 409 });
      discount = promoDiscount(promo, subtotal);
    }
    const total = subtotal + deliveryFee + serviceFee - discount;
    const fees = await loadFees(db);

    const order = await db.entities.Order.create({
      code: `AV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 9)}`,
      customer_email: context.user.email,
      customer_name: context.user.full_name || context.user.email,
      customer_phone: data.address_phone ?? "",
      store_id: store.id,
      store_name: store.name,
      owner_email: store.owner_email,
      items: priced.map(({ store_id, ...item }) => item),
      subtotal,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      discount,
      promo_code: promo?.code ?? "",
      total,
      status: "placed",
      payment_method: data.payment_method,
      payment_status: data.payment_method === "cash" ? "cash_due" : "pending",
      address_label: data.address_label ?? "Delivery",
      address_line: data.address_line,
      address_area: data.address_area ?? store.area ?? "",
      address_phone: data.address_phone ?? "",
      notes: data.notes ?? "",
      rider_payout: Math.round(deliveryFee * (1 - fees.riderPct / 100)),
      timeline: [
        {
          status: "placed",
          at: new Date().toISOString(),
          note: "Order placed",
          by: context.user.email,
        },
      ],
    });

    await db.entities.Payment.create({
      order_id: order.id,
      order_code: order.code,
      customer_email: context.user.email,
      amount: total,
      method: data.payment_method,
      status: data.payment_method === "cash" ? "cash_pending" : "pending",
      provider: "avora",
      note: data.payment_method === "cash" ? "Collect cash on delivery" : "Card payment on delivery",
    });

    if (promo) {
      await db.entities.PromoCode.update(promo.id, { used_count: (promo.used_count || 0) + 1 });
    }

    return { id: order.id, code: order.code, total, discount };
  });

/* ---------------------------------------------------------- vendor insight */

export const vendorInsights = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const store = (await db.entities.Store.filter({ owner_email: context.user.email }))[0];
    if (!store) return { store: null, totals: null, days: [], topProducts: [], statusMix: [], recent: [] };

    const orders = rows(
      await db.entities.Order.filter({ store_id: store.id }, { sort: "-created_date", limit: 300 })
    );
    const delivered = orders.filter((order) => order.status === "delivered");
    const active = orders.filter((order) =>
      ["placed", "accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up"].includes(order.status)
    );

    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const dayOrders = orders.filter(
        (order) => new Date(order.created_date).toISOString().slice(0, 10) === key
      );
      days.push({
        date: key.slice(5),
        sales: dayOrders
          .filter((order) => order.status === "delivered")
          .reduce((sum, order) => sum + (order.total || 0), 0),
        orders: dayOrders.length,
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

    const statusMap = new Map();
    for (const order of orders) statusMap.set(order.status, (statusMap.get(order.status) ?? 0) + 1);

    const sales = delivered.reduce((sum, order) => sum + (order.total || 0), 0);
    const fees = await loadFees(db);
    const vendable = delivered.reduce((sum, order) => sum + (order.subtotal || 0), 0);

    return {
      store,
      days,
      totals: {
        sales,
        commission: Math.round(vendable * (store.commission_rate ?? fees.vendorPct / 100)),
        orders: orders.length,
        live: active.length,
        delivered: delivered.length,
        avgOrder: delivered.length ? Math.round(sales / delivered.length) : 0,
        products: rows(await db.entities.Product.filter({ store_id: store.id })).length,
      },
      topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      statusMix: [...statusMap.entries()].map(([status, count]) => ({ status, count })),
      recent: orders.slice(0, 5),
    };
  });

/* ------------------------------------------------------------ rider desks */

export const riderAssignments = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = svc(context);
    const rider = (await db.entities.RiderProfile.filter({ user_email: context.user.email }))[0];
    if (!rider) return { rider: null, active: [], history: [] };
    const orders = rows(
      await db.entities.Order.filter({ rider_email: context.user.email }, { sort: "-created_date", limit: 60 })
    );
    const live = ["rider_assigned", "picked_up"];
    return {
      rider,
      active: orders.filter((order) => live.includes(order.status)),
      history: orders.filter((order) => !live.includes(order.status)),
    };
  });