import { createFileRoute } from "@tanstack/react-router";
import { consumeResetToken } from "@/server/auth.server";
import { checkRateLimit } from "@/server/rate-limit.server.js";
import { failure, jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = checkRateLimit(request, "reset-password", 10, 10 * 60 * 1000);
        if (limited) return limited;
        try {
          const body = await request.json().catch(() => ({}));
          const user = consumeResetToken(body.token ?? body.resetToken, body.password ?? body.newPassword);
          const { password_hash, ...safe } = user;
          return jsonWithCookies({ user: safe });
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
