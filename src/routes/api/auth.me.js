import { createFileRoute } from "@tanstack/react-router";
import { sessionUserFromRequest, updateUser } from "@/server/auth.server";
import { failure, jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return jsonWithCookies({ error: "Unauthorized" }, [], { status: 401 });
        return jsonWithCookies({ user });
      },
      PATCH: async ({ request }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return jsonWithCookies({ error: "Unauthorized" }, [], { status: 401 });
        try {
          const body = await request.json().catch(() => ({}));
          return jsonWithCookies({ user: updateUser(user.id, body) });
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
