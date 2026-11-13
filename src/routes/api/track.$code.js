import { createFileRoute } from "@tanstack/react-router";

const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

// Shareable tracking endpoint: anyone holding an order code can follow its
// progress without signing in. It never returns names, phone numbers or the
// full delivery address — only the status trail.
export const Route = createFileRoute("/api/track/$code")({
  server: {
    handlers: {
      GET: async ({ params, context }) => {
        const code = String(params.code || "").trim().toUpperCase();
        if (!code) return Response.json({ error: "Missing order code" }, { status: 400 });

        const db = context.getDb().asServiceRole;
        const orders = rows(await db.entities.Order.filter({ code }, { limit: 1 }));
        const order = orders[0];
        if (!order) return Response.json({ error: "No order with that code" }, { status: 404 });

        return Response.json(
          {
            code: order.code,
            status: order.status,
            store_name: order.store_name,
            placed_at: order.created_date,
            delivered_at: order.delivered_at || null,
            area: order.address_area || "",
            rider: order.rider_name ? order.rider_name.split(" ")[0] : "",
            timeline: (order.timeline ?? []).map((step) => ({
              status: step.status,
              at: step.at,
              note: step.note || "",
            })),
          },
          { headers: { "cache-control": "no-store" } }
        );
      },
    },
  },
});