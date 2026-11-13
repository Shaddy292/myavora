import { createFileRoute } from "@tanstack/react-router";
import { googleConsent, googleEnabled } from "@/server/oauth.server.js";
import { redirectWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!googleEnabled()) {
          return Response.json(
            { error: "Google sign-in is not configured on this server" },
            { status: 501 },
          );
        }
        const url = new URL(request.url);
        const { url: consentUrl, headers } = googleConsent(request, url.searchParams.get("returnTo"));
        return redirectWithCookies(consentUrl, headers["set-cookie"]);
      },
    },
  },
});
