import { createFileRoute } from "@tanstack/react-router";
import { sessionHeaders, upsertOAuthUser } from "@/server/auth.server";
import {
  clearOAuthCookies,
  fetchGoogleProfile,
  googleEnabled,
  verifyOAuthState,
} from "@/server/oauth.server.js";
import { checkRateLimit } from "@/server/rate-limit.server.js";
import { redirectWithCookies } from "@/server/http.server.js";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sendTo = (path, message) =>
          redirectWithCookies(message ? `${path}?error=${encodeURIComponent(message)}` : path, clearOAuthCookies()["set-cookie"]);
        if (!googleEnabled()) return sendTo("/login", "Google sign-in is not configured on this server");
        const limited = checkRateLimit(request, "google-callback", 20, 10 * 60 * 1000);
        if (limited) return limited;
        if (url.searchParams.get("error")) return sendTo("/login", "Google sign-in was cancelled");
        try {
          const code = url.searchParams.get("code");
          if (!code) return sendTo("/login", "Google sign-in failed — try again");
          const returnTo = verifyOAuthState(request, url.searchParams.get("state"));
          const profile = await fetchGoogleProfile(request, code);
          const user = upsertOAuthUser(profile);
          return redirectWithCookies(returnTo, [
            ...sessionHeaders(user.id)["set-cookie"],
            ...clearOAuthCookies()["set-cookie"],
          ]);
        } catch (error) {
          return sendTo("/login", error?.status && error.status < 500 ? error.message : "Google sign-in failed — try again");
        }
      },
    },
  },
});
