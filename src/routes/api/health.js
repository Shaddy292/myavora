import { createFileRoute } from "@tanstack/react-router";

const rows = (value) => (Array.isArray(value) ? value : value?.items ?? []);

// Uptime probe for monitoring and status pages.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ context }) => {
        let maintenance = false;
        try {
          const settings = rows(
            await context.getDb().asServiceRole.entities.PlatformSetting.list("-created_date", 1)
          )[0];
          maintenance = Boolean(settings?.maintenance_mode);
        } catch {
          maintenance = false;
        }
        return Response.json(
          { status: "ok", maintenance, now: new Date().toISOString() },
          { headers: { "cache-control": "no-store" } }
        );
      },
    },
  },
});