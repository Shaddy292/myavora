import { createFileRoute } from "@tanstack/react-router";
import { inviteUser, requireAdmin, sessionUserFromRequest } from "@/server/auth.server";
import { checkRateLimit } from "@/server/rate-limit.server.js";
import { failure, jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/users/invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = checkRateLimit(request, "invite", 20, 60 * 60 * 1000);
        if (limited) return limited;
        const user = sessionUserFromRequest(request);
        if (!user) return jsonWithCookies({ error: "Unauthorized" }, [], { status: 401 });
        try {
          requireAdmin(user);
          const body = await request.json().catch(() => ({}));
          return jsonWithCookies(inviteUser(body.email));
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
