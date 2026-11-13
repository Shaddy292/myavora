import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { entities } from "./store.server.js";
import { hashPassword, verifyPassword } from "./passwords.server.js";
import { config } from "./config.server.js";

const SESSION_COOKIE = "avora_session";
const MARKER_COOKIE = "avora_signed_in";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const RESET_MINUTES = 30;

const SECRET_FILE = path.join(config.dataDir, "secret");

const secret = () => {
  if (config.secret) return config.secret;
  if (globalThis.__avoraSecret) return globalThis.__avoraSecret;
  mkdirSync(config.dataDir, { recursive: true });
  const value = existsSync(SECRET_FILE) ? readFileSync(SECRET_FILE, "utf8").trim() : randomBytes(32).toString("hex");
  if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, value, { mode: 0o600 });
  globalThis.__avoraSecret = value;
  return value;
};

const sign = (value) => createHmac("sha256", secret()).update(value).digest("hex");

// The same file-backed secret signs sessions and the short-lived API tokens.
export const serverSecret = secret;

const sessionToken = (userId) => {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const body = `${userId}.${expires}`;
  return `${body}.${sign(body)}`;
};

const parseCookies = (header = "") =>
  Object.fromEntries(
    String(header)
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );

const verifySession = (token) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expires) * 1000 <= Date.now()) return null;
  return userId;
};

const cookie = (name, value, { maxAge = SESSION_SECONDS } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax;${config.secureCookies ? " Secure;" : ""} Max-Age=${maxAge}`;

const marker = (value) => `${MARKER_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=${value ? SESSION_SECONDS : 0}`;

export const sessionHeaders = (userId) => ({
  "set-cookie": [cookie(SESSION_COOKIE, sessionToken(userId)), marker("1")],
});

export const clearSessionHeaders = () => ({
  "set-cookie": [cookie(SESSION_COOKIE, "", { maxAge: 0 }), marker("")],
});

export const sessionUserFromRequest = (request) => {
  if (!request) return null;
  const cookies = parseCookies(request.headers.get("cookie"));
  const userId = verifySession(cookies[SESSION_COOKIE]);
  if (!userId) return null;
  try {
    const user = entities.get("User", userId);
    const { password_hash, ...safe } = user;
    return safe;
  } catch {
    return null;
  }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const findUser = (email) => entities.filter("User", { email: normalizeEmail(email) })[0];

const publicUser = (user) => {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
};

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

export const registerUser = ({ email, password, full_name }) => {
  const address = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) fail(400, "Enter a valid email address");
  if (String(password || "").length < 8) fail(400, "Password must be at least 8 characters");
  if (findUser(address)) fail(409, "An account with that email already exists");
  const user = entities.create("User", {
    email: address,
    full_name: String(full_name || "").trim() || address.split("@")[0],
    role: "user",
    password_hash: hashPassword(password),
  });
  return publicUser(user);
};

export const authenticate = ({ email, password }) => {
  const user = findUser(email);
  if (!user || !verifyPassword(password, user.password_hash)) fail(401, "Invalid email or password");
  return publicUser(user);
};

export const updateUser = (userId, data = {}) => {
  const allowed = [
    "full_name",
    "phone",
    "avatar_url",
    "area",
    "address",
    "payment_preference",
    "deletion_requested_at",
  ];
  const patch = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  return publicUser(entities.update("User", userId, patch));
};

export const setPassword = (userId, password) => {
  if (String(password || "").length < 8) fail(400, "Password must be at least 8 characters");
  entities.update("User", userId, { password_hash: hashPassword(password) });
};

export const requireAdmin = (user) => {
  if (user?.role !== "admin") fail(403, "Only administrators can do that");
};

export const createResetToken = (email) => {
  const user = findUser(email);
  if (!user) return null;
  const token = randomBytes(24).toString("hex");
  entities.create("PasswordReset", {
    token,
    user_id: user.id,
    email: user.email,
    expires_at: new Date(Date.now() + RESET_MINUTES * 60 * 1000).toISOString(),
  });
  return token;
};

export const consumeResetToken = (token, password) => {
  const row = entities.filter("PasswordReset", { token: String(token || "") })[0];
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) fail(400, "That reset link is invalid or has expired");
  setPassword(row.user_id, password);
  entities.delete("PasswordReset", row.id);
  return findUser(row.email);
};

export const inviteUser = (email) => {
  const address = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) fail(400, "Enter a valid email address");
  const existing = findUser(address);
  if (existing) return { ok: true, user: publicUser(existing) };
  const user = entities.create("User", {
    email: address,
    full_name: address.split("@")[0],
    role: "user",
    invited: true,
    password_hash: hashPassword(randomBytes(18).toString("hex")),
  });
  return { ok: true, user: publicUser(user) };
};

// Sign-in through an OAuth provider (Google): match the account by email or
// create it. The account has no local password until one is set explicitly.
export const upsertOAuthUser = ({ email, full_name, avatar_url }) => {
  const address = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) fail(400, "The provider did not return a usable email");
  const existing = findUser(address);
  if (existing) {
    const patch = {};
    if (avatar_url && !existing.avatar_url) patch.avatar_url = avatar_url;
    return publicUser(patch.avatar_url ? entities.update("User", existing.id, patch) : existing);
  }
  return publicUser(
    entities.create("User", {
      email: address,
      full_name: String(full_name || "").trim() || address.split("@")[0],
      role: "user",
      auth_provider: "google",
      avatar_url: avatar_url || "",
      password_hash: "",
    }),
  );
};
