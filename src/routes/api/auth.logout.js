import { createFileRoute } from "@tanstack/react-router";
import { clearSessionHeaders } from "@/server/auth.server";
import { jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async () => jsonWithCookies({ ok: true }, clearSessionHeaders()["set-cookie"]),
    },
  },
});
