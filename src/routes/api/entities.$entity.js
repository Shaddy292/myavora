import { createFileRoute } from "@tanstack/react-router";
import { sessionUserFromRequest } from "@/server/auth.server";
import { failure } from "@/server/http.server.js";

// Entity API for the browser client. Every call requires a signed-in session;
// personal tables are automatically narrowed to the session owner.
const ENTITY_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const number = (value) => {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const SECRET_FIELDS = ["password_hash", "password", "reset_token", "reset_token_hash", "reset_token_expires"];

const clean = (row) => {
  if (!row || typeof row !== "object") return row;
  const copy = { ...row };
  SECRET_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

// Rows in these tables are only visible to the account they belong to, unless
// the reader is an admin. Order additionally covers rides and owned stores.
const ownedStores = async (db, user) => {
  const stores = await db.entities.Store.filter({ owner_email: user.email });
  return new Set(stores.map((store) => store.id));
};

const canRead = (entity, row, user, stores) => {
  if (user.role === "admin") return true;
  if (entity === "User") return row.email === user.email;
  if (entity === "RiderProfile") return row.user_email === user.email;
  if (entity === "Order") {
    return row.customer_email === user.email || row.rider_email === user.email || stores.has(row.store_id);
  }
  if (entity === "Refund") return row.customer_email === user.email || row.user_email === user.email;
  if (entity === "SupportTicket") return row.user_email === user.email || row.customer_email === user.email;
  return true;
};

const visibleRows = async (db, entity, rows, user) => {
  if (user.role === "admin") return rows;
  const stores = entity === "Order" ? await ownedStores(db, user) : new Set();
  return rows.filter((row) => canRead(entity, row, user, stores));
};

const EMAIL_FIELD = {
  User: "email",
  RiderProfile: "user_email",
  Order: "customer_email",
  Refund: "customer_email",
  SupportTicket: "customer_email",
};

const assertCanWrite = async (db, entity, row, user) => {
  if (user.role === "admin") return;
  if (entity === "User") throw Object.assign(new Error("Forbidden"), { status: 403 });
  const field = EMAIL_FIELD[entity];
  if (field && row?.[field] === user.email) return;
  if (entity === "Order" && row?.store_id) {
    const stores = await ownedStores(db, user);
    if (stores.has(row.store_id)) return;
  }
  if (!EMAIL_FIELD[entity]) return;
  throw Object.assign(new Error("Forbidden"), { status: 403 });
};


export const Route = createFileRoute("/api/entities/$entity")({
  server: {
    handlers: {
      GET: async ({ request, params, context }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const entity = String(params.entity || "");
        if (!ENTITY_NAME.test(entity)) return Response.json({ error: "Unknown table" }, { status: 400 });

        try {
          const url = new URL(request.url);
          const query = parseJson(url.searchParams.get("query"), {});
          const db = context.getDb();
          const store = db.tableFor(entity, user);

          const id = url.searchParams.get("id");
          if (id !== null) {
            const row = await store.get(id);
            if (!row || !(await visibleRows(db, entity, [row], user)).length) {
              return Response.json({ error: "Not found" }, { status: 404 });
            }
            return Response.json(clean(row));
          }

          const sort = parseJson(url.searchParams.get("sort"), undefined);
          const rows = await visibleRows(db, entity, await store.filter(query, { sort }), user);
          if (url.searchParams.get("count") === "1") {
            return Response.json({ count: rows.length });
          }
          const skip = number(url.searchParams.get("skip")) ?? 0;
          const limit = number(url.searchParams.get("limit"));
          const windowed = limit === undefined ? rows.slice(skip) : rows.slice(skip, skip + limit);
          return Response.json(windowed.map(clean));
        } catch (error) {
          return failure(error);
        }
      },

      POST: async ({ request, params, context }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const entity = String(params.entity || "");
        if (!ENTITY_NAME.test(entity)) return Response.json({ error: "Unknown table" }, { status: 400 });

        try {
          const url = new URL(request.url);
          const body = await request.json().catch(() => ({}));
          const db = context.getDb();
          const store = db.tableFor(entity, user);
          const op = url.searchParams.get("op");

          if (op === "update-many") {
            if (entity === "User" && user.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403 });
            return Response.json((await store.updateMany(body.query ?? {}, body.data ?? {})).map(clean));
          }
          if (op === "delete-many") {
            if (entity === "User" && user.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403 });
            return Response.json(await store.deleteMany(body.query ?? {}));
          }

          if (user.role !== "admin" && entity === "User") {
            throw Object.assign(new Error("Forbidden"), { status: 403 });
          }
          const field = EMAIL_FIELD[entity];
          const data = field ? { ...body, [field]: user.email } : body;
          return Response.json(clean(await store.create(data)), { status: 201 });
        } catch (error) {
          return failure(error);
        }
      },

      PATCH: async ({ request, params, context }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const entity = String(params.entity || "");
        if (!ENTITY_NAME.test(entity)) return Response.json({ error: "Unknown table" }, { status: 400 });

        try {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return Response.json({ error: "An id is required" }, { status: 400 });
          const body = await request.json().catch(() => ({}));
          const db = context.getDb();
          const store = db.tableFor(entity, user);
          const row = await store.get(id);
          await assertCanWrite(db, entity, row, user);
          return Response.json(clean(await store.update(id, body)));
        } catch (error) {
          return failure(error);
        }
      },

      DELETE: async ({ request, params, context }) => {
        const user = sessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const entity = String(params.entity || "");
        if (!ENTITY_NAME.test(entity)) return Response.json({ error: "Unknown table" }, { status: 400 });

        try {
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return Response.json({ error: "An id is required" }, { status: 400 });
          const db = context.getDb();
          const store = db.tableFor(entity, user);
          const row = await store.get(id);
          await assertCanWrite(db, entity, row, user);
          return Response.json(await store.delete(id));
        } catch (error) {
          return failure(error);
        }
      },
    },
  },
});
