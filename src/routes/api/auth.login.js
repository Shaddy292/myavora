import { createFileRoute } from "@tanstack/react-router";
import { authenticate, sessionHeaders } from "@/server/auth.server";
import { checkRateLimit } from "@/server/rate-limit.server.js";
import { failure, jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = checkRateLimit(request, "login", 10, 5 * 60 * 1000);
        if (limited) return limited;
        try {
          const body = await request.json().catch(() => ({}));
          const user = authenticate(body);
          return jsonWithCookies({ user }, sessionHeaders(user.id)["set-cookie"]);
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
