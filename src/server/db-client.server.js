import { entities } from "./store.server.js";
import { PERSONAL_TABLES, userDb } from "./scoped.server.js";

const table = (entity) => ({
  filter: async (query = {}, options = {}) => entities.filter(entity, query, options),
  list: async (sort, limit) => entities.list(entity, sort, limit),
  get: async (id) => entities.get(entity, id),
  count: async (query = {}) => entities.count(entity, query),
  create: async (data) => entities.create(entity, data),
  update: async (id, data) => entities.update(entity, id, data),
  delete: async (id) => entities.delete(entity, id),
  bulkCreate: async (items = []) => items.map((item) => entities.create(entity, item)),
  bulkUpdate: async (items = []) => items.map((item) => entities.update(entity, item.id, item)),
  updateMany: async (query = {}, data = {}) => entities.updateMany(entity, query, data),
  deleteMany: async (query = {}) => entities.deleteMany(entity, query),
  subscribe: () => () => {},
});

const tables = new Proxy({}, { get: (_target, entity) => table(String(entity)) });

const client = {
  entities: tables,
  auth: {
    // Server functions receive the caller as `context.user`; there is no ambient session here.
    me: async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    },
  },
  users: { inviteUser: async () => ({ ok: true }) },
  integrations: {
    Core: {
      UploadPublicFile: async () => ({ file_url: "", file_uri: "" }),
      UploadPrivateFile: async () => ({ file_url: "", file_uri: "" }),
      CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: file_uri }),
    },
  },
  functions: { invoke: async () => ({ data: null }) },
};

client.asServiceRole = client;
// A client narrowed to one account's rows, for personal tables.
client.as = (email) => userDb(email);
// The table a request may touch: personal tables are owner-scoped.
client.tableFor = (entity, user) =>
  (PERSONAL_TABLES.has(entity) ? userDb(user.email) : client).entities[entity];

export const getDb = () => client;
