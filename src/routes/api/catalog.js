import { createFileRoute } from "@tanstack/react-router";

const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

// Public read-only catalogue feed: lets a shareable link, a partner site or the
// mobile shell list the approved stores without signing in.
export const Route = createFileRoute("/api/catalog")({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") || "").trim().toLowerCase();
        const category = (url.searchParams.get("category") || "").trim();
        const db = context.getDb().asServiceRole;

        const [stores, categories] = await Promise.all([
          db.entities.Store.list("-rating", 200),
          db.entities.Category.filter({ is_active: true }, { sort: "position", limit: 40 }),
        ]);

        const live = rows(stores).filter(
          (store) =>
            store.is_approved !== false &&
            (!category || category === "All" || store.category === category) &&
            (!q ||
              [store.name, store.tagline, store.category, store.area].some((value) =>
                (value || "").toLowerCase().includes(q)
              ))
        );

        return Response.json(
          {
            count: live.length,
            categories: rows(categories).map((c) => c.name),
            stores: live.map((store) => ({
              id: store.id,
              name: store.name,
              category: store.category,
              tagline: store.tagline,
              area: store.area,
              logo_url: store.logo_url || "",
              rating: store.rating ?? null,
              eta_min: store.eta_min ?? null,
              eta_max: store.eta_max ?? null,
              delivery_fee: store.delivery_fee ?? 0,
              min_order: store.min_order ?? 0,
              is_open: store.is_open !== false,
              url: `/store-menu?store=${store.id}`,
            })),
          },
          { headers: { "cache-control": "public, s-maxage=60" } }
        );
      },
    },
  },
});