import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { DEMO_USER, seedData } from "./seed.js";
import { hashPassword, isPasswordHash } from "./passwords.server.js";
import { config } from "./config.server.js";

const DATA_DIR = config.dataDir;
const DB_FILE = path.join(DATA_DIR, "avora.json");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const DEMO_PASSWORD = config.demoPassword;

const globalStore = globalThis;
const CACHE_KEY = Symbol.for("avora.store");

const clone = (value) => (value === undefined ? value : structuredClone(value));

const writeDb = (tables) => {
  mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.tmp`;
  writeFileSync(temp, JSON.stringify({ version: 1, tables }, null, 2));
  renameSync(temp, DB_FILE);
};

const loadDb = () => {
  if (existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DB_FILE, "utf8"));
      if (parsed?.tables && typeof parsed.tables === "object") return parsed.tables;
    } catch {
      // A corrupt file is replaced by fresh demo data rather than crashing every request.
    }
  }
  const tables = config.demo ? seedData() : {};
  writeDb(tables);
  return tables;
};

const state = (globalStore[CACHE_KEY] ??= {
  tables: null,
  timer: null,
  save: () => {},
});

const tables = () => (state.tables ??= loadDb());

const persist = () => {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    try {
      writeDb(tables());
    } catch (error) {
      console.error("[avora] could not save the database", error);
    }
  }, 25);
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

const nextId = (entity) => `${String(entity).toLowerCase()}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

const rowsFor = (entity) => {
  const db = tables();
  if (!db[entity]) db[entity] = [];
  if (config.demo && entity === "User") {
    const demo = db[entity].find((row) => row.email === DEMO_USER.email);
    if (demo && !isPasswordHash(demo.password_hash)) {
      demo.password_hash = hashPassword(DEMO_PASSWORD);
      persist();
    }
  }
  return db[entity];
};

const select = (entity, query = {}, options = {}) => {
  let rows = rowsFor(entity).filter((row) => matchesQuery(row, query));
  rows = sortRows(rows, options.sort);
  if (typeof options.skip === "number") rows = rows.slice(options.skip);
  if (typeof options.limit === "number") rows = rows.slice(0, options.limit);
  return rows;
};

export const entityNames = () => Object.keys(tables());

export const entities = {
  filter(entity, query, options) {
    return select(entity, query, options).map(clone);
  },
  list(entity, sort, limit) {
    return select(entity, {}, { sort, limit }).map(clone);
  },
  count(entity, query) {
    return select(entity, query).length;
  },
  get(entity, id) {
    const row = rowsFor(entity).find((candidate) => candidate.id === id);
    if (!row) throw Object.assign(new Error(`No ${entity} with id ${id}`), { status: 404 });
    return clone(row);
  },
  create(entity, data) {
    const timestamp = new Date().toISOString();
    const row = {
      ...data,
      id: data?.id ?? nextId(entity),
      created_date: data?.created_date ?? timestamp,
      updated_date: timestamp,
    };
    rowsFor(entity).unshift(row);
    persist();
    return clone(row);
  },
  update(entity, id, data) {
    const row = rowsFor(entity).find((candidate) => candidate.id === id);
    if (!row) throw Object.assign(new Error(`No ${entity} with id ${id}`), { status: 404 });
    applyPatch(row, data);
    Object.assign(row, { id: row.id, updated_date: new Date().toISOString() });
    persist();
    return clone(row);
  },
  delete(entity, id) {
    const rows = rowsFor(entity);
    const before = rows.length;
    tables()[entity] = rows.filter((row) => row.id !== id);
    if (before !== tables()[entity].length) persist();
    return { id, deleted: before !== tables()[entity].length };
  },
  updateMany(entity, query, data) {
    const rows = select(entity, query);
    rows.forEach((row) => {
      applyPatch(row, data);
      Object.assign(row, { updated_date: new Date().toISOString() });
    });
    persist();
    return rows.map(clone);
  },
  deleteMany(entity, query) {
    const rows = select(entity, query);
    const ids = new Set(rows.map((row) => row.id));
    tables()[entity] = rowsFor(entity).filter((row) => !ids.has(row.id));
    persist();
    return { deleted: ids.size };
  },
};

export const DEMO_CREDENTIALS = { email: DEMO_USER.email, password: DEMO_PASSWORD };
export { DB_FILE };
