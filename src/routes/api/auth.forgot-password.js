import { createFileRoute } from "@tanstack/react-router";
import { createResetToken } from "@/server/auth.server";
import { checkRateLimit } from "@/server/rate-limit.server.js";
import { jsonWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const limited = checkRateLimit(request, "forgot-password", 3, 10 * 60 * 1000);
        if (limited) return limited;
        const body = await request.json().catch(() => ({}));
        const token = createResetToken(body.email);
        if (token) {
          const origin = new URL(request.url).origin;
          console.log(`[avora] password reset for ${body.email}: ${origin}/reset-password?token=${token}`);
        }
        // Always the same answer: never reveal whether the email is registered.
        return jsonWithCookies({ ok: true });
      },
    },
  },
});
