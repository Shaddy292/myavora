import path from "node:path";

const bool = (value, fallback) =>
  value === undefined || value === "" ? fallback : ["1", "true", "yes", "on"].includes(String(value).toLowerCase());

const int = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isProd = process.env.NODE_ENV === "production";

// Process-wide settings, overridable through the environment. Defaults keep
// local development working; production deployments set the AVORA_* vars.
export const config = {
  isProd,
  port: int(process.env.PORT, isProd ? 3000 : 5173),
  host: process.env.HOST || "0.0.0.0",
  // The demo dataset (stores, menus, demo admin) is seeded on first boot.
  demo: bool(process.env.AVORA_DEMO, true),
  // Set AVORA_DEMO_PASSWORD to change the demo admin password.
  demoPassword: process.env.AVORA_DEMO_PASSWORD || "demo1234",
  // Secret for session cookies and API tokens. Falls back to .data/secret.
  secret: process.env.AVORA_SECRET || "",
  // Add the Secure flag to cookies — required behind HTTPS, harmful on http://localhost.
  secureCookies: bool(process.env.AVORA_SECURE_COOKIES, false),
  // Google sign-in (OAuth 2.0). Empty = the feature is off and the buttons hide.
  googleClientId: process.env.AVORA_GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.AVORA_GOOGLE_CLIENT_SECRET || "",
  dataDir: path.resolve(process.env.AVORA_DATA_DIR || path.join(process.cwd(), ".data")),
};
