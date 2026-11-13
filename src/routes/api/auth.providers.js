import { createFileRoute } from "@tanstack/react-router";
import { googleEnabled } from "@/server/oauth.server.js";

export const Route = createFileRoute("/api/auth/providers")({
  server: {
    handlers: {
      GET: async () => Response.json({ google: googleEnabled() }),
    },
  },
});
