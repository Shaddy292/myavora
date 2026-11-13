// Local preview for the packaged SPA (server-php/public) when PHP is not
// installed. Serves the static build with the .htaccess fallback semantics,
// answers the shell-critical /api/fn calls from the seed dataset, and mimics
// the entity API (scoping + in-memory writes) so signed-in screens match the
// Node dev server. Preview only — the real backend is server-php/ on the host.
//
//   npm run build:php && npm run package:php
//   node scripts/preview-php-build.mjs            (anonymous landing)
//   open http://localhost:8443/?demo=1            (signed-in storefront)
//
// With AVORA_PHP_ORIGIN=http://127.0.0.1:8080 every /api/* request is proxied
// to the real PHP backend instead, so the package can be exercised against it.
import { createServer, request as httpRequest } from "node:http";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { seedData } from "../src/server/seed.js";

const ROOT = path.resolve(import.meta.dirname, "..", "server-php", "public");
const PORT = Number(process.env.PORT || 8443);
const PHP_ORIGIN = process.env.AVORA_PHP_ORIGIN || "";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

const tables = seedData();
const ngn = (value) => `₦${Math.round(Number(value) || 0).toLocaleString("en-US")}`;
const demoUser = () => {
  const { password_hash, ...safe } = tables.User[0];
  return safe;
};

const homeFeed = () => {
  const stores = tables.Store.filter((s) => s.is_approved && s.is_open)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 60);
  return {
    storeCount: tables.Store.filter((s) => s.is_approved).length,
    categories: tables.Category.filter((c) => c.is_active)
      .slice(0, 12)
      .map((c) => ({ label: c.name, emoji: c.emoji || "🍽️", tint: c.tint || "bg-[#F6EEFB]" })),
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || "",
      cuisine: s.tagline || s.category || "",
      rating: s.rating ?? "—",
      eta: `${s.eta_min ?? 20}–${s.eta_max ?? 35} min`,
      fee: s.delivery_fee ? `${ngn(s.delivery_fee)} delivery` : "Free delivery",
      promo: s.promo || "",
      cover: s.cover_url || (s.photos ?? [])[0] || "",
    })),
    essentials: sortRows(
      tables.Product.filter((p) => p.is_available),
      "-created_date"
    )
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit || p.category || "",
        price: ngn(p.price),
        emoji: p.emoji || "🛍️",
        tint: p.tint || "bg-[#F6EEFB]",
        image_url: p.image_url || "",
      })),
  };
};

const siteContent = () => {
  const record = [...tables.PlatformContent].sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  return {
    id: record?.id ?? null,
    announcement_title: record?.announcement_title ?? "",
    announcement_body: record?.announcement_body ?? "",
    announcement_tone: record?.announcement_tone ?? "purple",
    announcement_active: record?.announcement_active ?? false,
    banners: record?.banners ?? [],
    featured_categories: record?.featured_categories ?? [],
  };
};

const signedIn = (req) => /(?:^|;\s*)avora_signed_in=1/.test(req.headers.cookie || "");

// Entity API mock: same read/write semantics as src/server/store.server.js and
// src/routes/api/entities.$entity.js, backed by the in-memory seed. Writes are
// lost when the process exits — preview only.
const PERSONAL_TABLES = new Set(["Address", "PaymentMethod", "Favorite", "Notification"]);
const SECRET_FIELDS = ["password_hash", "password", "reset_token", "reset_token_hash", "reset_token_expires"];
const EMAIL_FIELD = {
  User: "email",
  RiderProfile: "user_email",
  Order: "customer_email",
  Refund: "customer_email",
  SupportTicket: "customer_email",
};

const clean = (row) => {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  SECRET_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

const valuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const matchesQuery = (record, query) =>
  Object.entries(query ?? {}).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if ("$in" in expected) return (expected.$in ?? []).some((value) => valuesEqual(actual, value));
      if ("$exists" in expected) {
        const present = actual !== undefined && actual !== null && actual !== "";
        return present === Boolean(expected.$exists);
      }
      if ("$ne" in expected) return !valuesEqual(actual, expected.$ne);
      if ("$gt" in expected) return actual > expected.$gt;
      if ("$gte" in expected) return actual >= expected.$gte;
      if ("$lt" in expected) return actual < expected.$lt;
      if ("$lte" in expected) return actual <= expected.$lte;
      if ("$nin" in expected) return !(expected.$nin ?? []).some((value) => valuesEqual(actual, value));
      return valuesEqual(actual, expected);
    }
    if (Array.isArray(actual)) return actual.some((value) => valuesEqual(value, expected));
    return valuesEqual(actual, expected);
  });

const compare = (a, b) => {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  return a < b ? -1 : 1;
};

const sortRows = (rows, sort) => {
  if (!sort) return rows;
  const fields = (Array.isArray(sort) ? sort : [sort]).filter(Boolean);
  return [...rows].sort((left, right) => {
    for (const spec of fields) {
      const descending = String(spec).startsWith("-");
      const field = String(spec).replace(/^[+-]/, "");
      const result = compare(left[field], right[field]);
      if (result !== 0) return descending ? -result : result;
    }
    return 0;
  });
};

const applyPatch = (row, data = {}) => {
  const { $set, $unset, $inc, $push, ...plain } = data ?? {};
  Object.assign(row, plain);
  if ($set && typeof $set === "object") Object.assign(row, $set);
  if ($unset && typeof $unset === "object") Object.keys($unset).forEach((key) => delete row[key]);
  if ($inc && typeof $inc === "object") {
    Object.entries($inc).forEach(([key, amount]) => {
      row[key] = (Number(row[key]) || 0) + amount;
    });
  }
  if ($push && typeof $push === "object") {
    Object.entries($push).forEach(([key, value]) => {
      row[key] = [...(Array.isArray(row[key]) ? row[key] : []), value];
    });
  }
  return row;
};

const entityRows = (entity) => (tables[entity] ??= []);
const nextId = (entity) => `${String(entity).toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

const ownedStores = (user) =>
  new Set(entityRows("Store").filter((store) => store.owner_email === user.email).map((store) => store.id));

const canRead = (entity, row, user, stores) => {
  if (user.role === "admin") return true;
  if (entity === "User") return row.email === user.email;
  if (entity === "RiderProfile") return row.user_email === user.email;
  if (entity === "Order") return row.customer_email === user.email || row.rider_email === user.email || stores.has(row.store_id);
  if (entity === "Refund") return row.customer_email === user.email || row.user_email === user.email;
  if (entity === "SupportTicket") return row.user_email === user.email || row.customer_email === user.email;
  return true;
};

const assertCanWrite = (entity, row, user) => {
  if (user.role === "admin") return;
  if (entity === "User") throw Object.assign(new Error("Forbidden"), { status: 403 });
  const field = EMAIL_FIELD[entity];
  if (field && row?.[field] === user.email) return;
  if (entity === "Order" && row?.store_id && ownedStores(user).has(row.store_id)) return;
  if (field) throw Object.assign(new Error("Forbidden"), { status: 403 });
};

// Personal tables: every call is narrowed to the signed-in owner.
const scopedRows = (entity, user, query = {}) =>
  entityRows(entity).filter((row) => matchesQuery(row, PERSONAL_TABLES.has(entity) ? { ...query, user_email: user.email } : query));

const handleEntities = (req, res, pathname, url, user) => {
  const entity = pathname.slice("/api/entities/".length);
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(entity)) return json(res, 400, { error: "Unknown table" });
  const personal = PERSONAL_TABLES.has(entity);
  const stores = entity === "Order" ? ownedStores(user) : new Set();

  if (req.method === "GET") {
    const parse = (value, fallback) => {
      if (!value) return fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    };
    const id = url.searchParams.get("id");
    if (id !== null) {
      const row = entityRows(entity).find((candidate) => candidate.id === id);
      if (!row || (personal && row.user_email !== user.email) || !canRead(entity, row, user, stores)) {
        return json(res, 404, { error: "Not found" });
      }
      return json(res, 200, clean(row));
    }
    const query = parse(url.searchParams.get("query"), {});
    const rows = scopedRows(entity, user, query).filter((row) => canRead(entity, row, user, stores));
    if (url.searchParams.get("count") === "1") return json(res, 200, { count: rows.length });
    const sorted = sortRows(rows, parse(url.searchParams.get("sort"), undefined));
    const skip = Number(url.searchParams.get("skip")) || 0;
    const limit = url.searchParams.get("limit");
    const windowed = limit === null ? sorted.slice(skip) : sorted.slice(skip, skip + Number(limit));
    return json(res, 200, windowed.map(clean));
  }

  readJson(req).then((body) => {
    if (req.method === "POST") {
      const op = url.searchParams.get("op");
      if (op === "update-many" || op === "delete-many") {
        if (entity === "User" && user.role !== "admin") return json(res, 403, { error: "Forbidden" });
        const matched = scopedRows(entity, user, body.query ?? {});
        if (op === "update-many") return json(res, 200, matched.map((row) => clean(applyPatch(row, body.data ?? {}))));
        tables[entity] = entityRows(entity).filter((row) => !matched.includes(row));
        return json(res, 200, { count: matched.length });
      }
      if (user.role !== "admin" && entity === "User") return json(res, 403, { error: "Forbidden" });
      const data = { ...body };
      if (personal) data.user_email = user.email;
      if (EMAIL_FIELD[entity]) data[EMAIL_FIELD[entity]] = user.email;
      const now = new Date().toISOString();
      const row = { id: nextId(entity), created_date: now, updated_date: now, ...data };
      entityRows(entity).unshift(row);
      return json(res, 201, clean(row));
    }

    if (req.method === "PATCH" || req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json(res, 400, { error: "An id is required" });
      const row = entityRows(entity).find((candidate) => candidate.id === id);
      if (!row) return json(res, 404, { error: "Not found" });
      if (personal && row.user_email !== user.email) return json(res, 404, { error: "Not found" });
      try {
        if (req.method === "DELETE") {
          if (personal) {
            tables[entity] = entityRows(entity).filter((candidate) => candidate !== row);
            return json(res, 200, clean(row));
          }
          assertCanWrite(entity, row, user);
          tables[entity] = entityRows(entity).filter((candidate) => candidate !== row);
          return json(res, 200, clean(row));
        }
        if (!personal) assertCanWrite(entity, row, user);
        return json(res, 200, clean(applyPatch(row, body)));
      } catch (error) {
        return json(res, error.status || 500, { error: error.message });
      }
    }

    return json(res, 405, { error: "Method not allowed" });
  });
};

const readJson = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });

const json = (res, status, body, cookies = []) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(cookies.length ? { "set-cookie": cookies } : {}),
  });
  res.end(JSON.stringify(body));
};

const FUNCTION_TABLE = {
  "session/visitor": ({ user }) => user,
  "server/getServerInfo": () => ({ renderedAt: new Date().toISOString() }),
  "insight/getSiteContent": () => siteContent(),
  "catalog/homeFeed": () => homeFeed(),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (PHP_ORIGIN && pathname.startsWith("/api/")) {
    const target = new URL(req.url, PHP_ORIGIN);
    const headers = { ...req.headers, host: target.host };
    const proxy = httpRequest(
      { hostname: target.hostname, port: target.port || 80, path: target.pathname + target.search, method: req.method, headers },
      (upstream) => {
        const out = {};
        for (const [key, value] of Object.entries(upstream.headers)) {
          if (key === "connection" || key === "transfer-encoding" || key === "set-cookie") continue;
          out[key] = value;
        }
        if (upstream.headers["set-cookie"]) out["set-cookie"] = upstream.headers["set-cookie"];
        res.writeHead(upstream.statusCode || 502, out);
        upstream.pipe(res);
      }
    );
    proxy.on("error", () => json(res, 502, { error: "PHP backend unreachable" }));
    req.pipe(proxy);
    return;
  }

  if (pathname === "/api/auth/me") {
    if (!signedIn(req)) return json(res, 401, { error: "Unauthorized" });
    return json(res, 200, { user: demoUser() });
  }
  if (pathname === "/api/auth/providers") return json(res, 200, { google: false });
  if (pathname === "/api/auth/logout") {
    return json(res, 200, { ok: true }, ['avora_signed_in=; Path=/; Max-Age=0', 'avora_session=; Path=/; Max-Age=0']);
  }
  if (pathname.startsWith("/api/entities/")) {
    if (!signedIn(req)) return json(res, 401, { error: "Unauthorized" });
    return handleEntities(req, res, pathname, url, demoUser());
  }
  const fnMatch = pathname.match(/^\/api\/fn\/([a-z][a-z0-9-]*)\/([A-Za-z0-9_]+)$/);
  if (fnMatch) {
    const handler = FUNCTION_TABLE[`${fnMatch[1]}/${fnMatch[2]}`];
    if (!handler) return json(res, 501, { error: `Not ported in the preview harness: ${pathname}` });
    let body = {};
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const user = signedIn(req) ? demoUser() : null;
    return json(res, 200, { result: handler({ data: body.data, user }) });
  }
  if (pathname.startsWith("/api/")) return json(res, 501, { error: "Not available in the preview harness" });

  let file = path.join(ROOT, pathname === "/" ? "index.html" : pathname);
  try {
    if (!statSync(file).isFile()) throw new Error("directory");
  } catch {
    file = path.join(ROOT, "index.html");
  }
  try {
    const html = path.extname(file) === ".html";
    const headers = { "content-type": TYPES[path.extname(file)] || "application/octet-stream" };
    if (!html) headers["cache-control"] = "public, max-age=31536000, immutable";
    if (html && url.searchParams.get("demo") === "1") headers["set-cookie"] = "avora_signed_in=1; Path=/; SameSite=Lax";
    res.writeHead(200, headers);
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`SPA preview on http://localhost:${PORT}  (anonymous)`);
  console.log(`Signed-in view:  http://localhost:${PORT}/?demo=1`);
  if (PHP_ORIGIN) console.log(`Proxying /api/* to ${PHP_ORIGIN}`);
});
