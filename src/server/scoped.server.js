import { entities } from "./store.server.js";

const locked = () => Object.assign(new Error("Not found"), { status: 404 });

// Personal tables carry `user_email`; every read and write goes through the
// signed-in owner so one account can never see another's rows.
export const scopedTable = (entity, email) => {
  const owned = (query = {}) => ({ ...query, user_email: email });
  const mine = (id) => {
    const row = entities.get(entity, id);
    if (row.user_email !== email) throw locked();
    return row;
  };

  return {
    filter: async (query = {}, options = {}) => entities.filter(entity, owned(query), options),
    list: async (sort, limit) => entities.filter(entity, owned(), { sort, limit }),
    get: async (id) => mine(id),
    count: async (query = {}) => entities.count(entity, owned(query)),
    create: async (data = {}) => entities.create(entity, { ...data, user_email: email }),
    update: async (id, data) => {
      mine(id);
      return entities.update(entity, id, data);
    },
    delete: async (id) => {
      mine(id);
      return entities.delete(entity, id);
    },
    bulkCreate: async (items = []) =>
      items.map((item) => entities.create(entity, { ...item, user_email: email })),
    bulkUpdate: async (items = []) =>
      items.map((item) => {
        mine(item.id);
        return entities.update(entity, item.id, item);
      }),
    updateMany: async (query = {}, data = {}) => entities.updateMany(entity, owned(query), data),
    deleteMany: async (query = {}) => entities.deleteMany(entity, owned(query)),
    subscribe: () => () => {},
  };
};

// Client for the signed-in visitor, the local equivalent of row-level security.
export const userDb = (email) => {
  const tables = new Proxy({}, { get: (_target, entity) => scopedTable(String(entity), email) });
  return {
    entities: tables,
    auth: {
      me: async () => {
        const [row] = entities.filter("User", { email });
        if (!row) throw locked();
        const { password_hash, ...safe } = row;
        return safe;
      },
    },
  };
};

export const PERSONAL_TABLES = new Set(["Address", "PaymentMethod", "Favorite", "Notification"]);
