import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config.server.js";
import { serverSecret } from "./auth.server.js";

const STATE_COOKIE = "avora_oauth_state";
const RETURN_COOKIE = "avora_oauth_return";
const STATE_SECONDS = 10 * 60;
const AUTH_ORIGINS = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
const SCOPE = "openid email profile";

export const googleEnabled = () => Boolean(config.googleClientId && config.googleClientSecret);

const sign = (value) => createHmac("sha256", serverSecret()).update(value).digest("hex");

const secureFlag = () => (config.secureCookies ? " Secure;" : "");

const cookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax;${secureFlag()} Max-Age=${maxAge}`;

// The request's public origin, honoring the proxy headers when present.
export const requestOrigin = (request) => {
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  return `${String(proto).split(",")[0].trim()}://${String(host).split(",")[0].trim()}`;
};

// Server-side counterpart of the client returnTo sanitizer: a post-auth
// destination must be a local path that is not an auth page.
const sanitizeReturnTo = (raw) => {
  const value = String(raw || "/");
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  const path = value.split("?")[0].replace(/\/+$/, "") || "/";
  if (AUTH_ORIGINS.has(path)) return "/";
  return value;
};

// Builds the Google consent redirect for GET /api/auth/google and the two
// short-lived cookies that carry the state and the post-auth destination.
export const googleConsent = (request, returnTo) => {
  const origin = requestOrigin(request);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const nonce = randomBytes(16).toString("hex");
  const state = `${nonce}.${sign(nonce)}`;
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return {
    url: url.toString(),
    headers: {
      "set-cookie": [
        cookie(STATE_COOKIE, state, STATE_SECONDS),
        cookie(RETURN_COOKIE, sanitizeReturnTo(returnTo), STATE_SECONDS),
      ],
    },
  };
};

const readCookie = (request, name) => {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
};

const consumeCookie = (name) => `${name}=; Path=/; HttpOnly; SameSite=Lax;${secureFlag()} Max-Age=0`;

// Validates the callback state against the consent cookie. Returns the saved
// post-auth destination ("/" when absent).
export const verifyOAuthState = (request, state) => {
  const expected = readCookie(request, STATE_COOKIE);
  const ok =
    expected &&
    state &&
    expected.length === state.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(state)) &&
    expected === state;
  if (!ok) {
    throw Object.assign(new Error("That sign-in link expired — try again"), { status: 400 });
  }
  const raw = readCookie(request, RETURN_COOKIE);
  return sanitizeReturnTo(raw);
};

// Cookies that clear the OAuth round-trip state on the callback response.
export const clearOAuthCookies = () => ({ "set-cookie": [consumeCookie(STATE_COOKIE), consumeCookie(RETURN_COOKIE)] });

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

// Exchanges the authorization code and returns the Google profile.
export const fetchGoogleProfile = async (request, code) => {
  const origin = requestOrigin(request);
  const body = new URLSearchParams({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    code: String(code || ""),
    grant_type: "authorization_code",
    redirect_uri: `${origin}/api/auth/google/callback`,
  });
  const tokenResponse = await fetch(GOOGLE_TOKEN, { method: "POST", body }).catch(() => null);
  if (!tokenResponse?.ok) fail(502, "Could not reach Google — try again in a moment");
  const tokens = await tokenResponse.json().catch(() => null);
  if (!tokens?.access_token) fail(401, "Google rejected the sign-in — try again");
  const profileResponse = await fetch(GOOGLE_USERINFO, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  }).catch(() => null);
  if (!profileResponse?.ok) fail(502, "Could not load the Google profile — try again");
  const profile = await profileResponse.json().catch(() => null);
  if (!profile?.email) fail(401, "Google did not share an email for that account");
  return {
    email: profile.email,
    full_name: profile.name || "",
    avatar_url: profile.picture || "",
  };
};
