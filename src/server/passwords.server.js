import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export const isPasswordHash = (value) => typeof value === "string" && /^[a-f0-9]{32}:[a-f0-9]+$/i.test(value);

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(String(password), salt, KEY_LENGTH).toString("hex")}`;
}

export function verifyPassword(password, stored) {
  if (!isPasswordHash(stored)) return false;
  const [salt, digest] = stored.split(":");
  const attempt = scryptSync(String(password), salt, KEY_LENGTH);
  const expected = Buffer.from(digest, "hex");
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}
