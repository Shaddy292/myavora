// Copies the PHP-target SPA build (npm run build:php) into the cPanel package
// while preserving the backend entry points. Run after build:php:
//   npm run build:php && npm run package:php
import { cpSync, existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CLIENT = path.join(ROOT, "dist", "client");
const PUBLIC = path.join(ROOT, "server-php", "public");
const KEEP = new Set(["index.php", ".htaccess", "uploads"]);

if (!existsSync(path.join(CLIENT, "_shell.html"))) {
  console.error("dist/client/_shell.html not found — run `npm run build:php` first.");
  process.exit(1);
}

// Clear only what a previous packaging run would have produced.
for (const entry of readdirSync(PUBLIC)) {
  if (!KEEP.has(entry)) rmSync(path.join(PUBLIC, entry), { recursive: true, force: true });
}

for (const entry of readdirSync(CLIENT)) {
  if (entry === "_shell.html") continue;
  cpSync(path.join(CLIENT, entry), path.join(PUBLIC, entry), { recursive: true });
}

// TanStack Start names the SPA document _shell.html; static hosts need index.html.
renameSync(path.join(CLIENT, "_shell.html"), path.join(PUBLIC, "index.html"));

console.log(`Packaged the SPA into ${path.relative(ROOT, PUBLIC)}/ (index.html + assets).`);
