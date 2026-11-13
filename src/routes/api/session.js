import { createFileRoute } from "@tanstack/react-router";
import { requireApiTokenRoute } from "@/lib/jwt.server";

// Verifies an AVORA access token (`Authorization: Bearer <token>`) and returns
// whose session it is. Expired or tampered tokens get 401.
export const Route = createFileRoute("/api/session")({
  server: {
    middleware: [requireApiTokenRoute],
    handlers: {
      GET: async ({ context }) =>
        Response.json(
          {
            user_id: context.apiUser.sub,
            email: context.apiUser.email,
            role: context.apiUser.role,
            issued_at: new Date(context.apiUser.iat * 1000).toISOString(),
            expires_at: new Date(context.apiUser.exp * 1000).toISOString(),
          },
          { headers: { "cache-control": "no-store" } }
        ),
    },
  },
});