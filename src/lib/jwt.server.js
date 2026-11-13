import { createMiddleware } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverSecret } from "@/server/auth.server";

// AVORA's own short-lived access tokens. HS256, 15-minute expiry.
const ALG = "HS256";
const TTL_SECONDS = 15 * 60;
const AUDIENCE = "avora-api";

const signingKey = () => serverSecret();

const b64url = (value) => Buffer.from(value).toString("base64url");

const decode = (segment) => Buffer.from(segment, "base64url").toString("utf8");

const sign = (data) => createHmac("sha256", signingKey()).update(data).digest("base64url");

const sameSignature = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

export async function signAccessToken(claims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, aud: AUDIENCE, iat: now, exp: now + TTL_SECONDS };
  const head = b64url(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return {
    token: `${head}.${body}.${sign(`${head}.${body}`)}`,
    payload,
    expires_in: TTL_SECONDS,
  };
}

export async function verifyAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;

  let header;
  try {
    header = JSON.parse(decode(head));
  } catch {
    return null;
  }
  if (header?.alg !== ALG) return null;
  if (!sameSignature(sign(`${head}.${body}`), signature)) return null;

  let payload;
  try {
    payload = JSON.parse(decode(body));
  } catch {
    return null;
  }
  if (payload?.aud !== AUDIENCE) return null;
  if (!payload?.exp || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

// Guards a server route with a bearer token: `server: { middleware: [requireApiTokenRoute], handlers }`
export const requireApiTokenRoute = createMiddleware({ type: "request" }).server(async ({ next, request }) => {
  const header = request.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const claims = await verifyAccessToken(token);
  if (!claims) return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  return next({ context: { apiUser: claims } });
});
