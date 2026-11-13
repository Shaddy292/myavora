// The browser-facing database client. Every call goes to the app's own HTTP
// API (src/routes/api), which authenticates the visitor from the session cookie.

const request = async (url, { method = "GET", body } = {}) => {
  const init = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || response.statusText || "Request failed"), {
      status: response.status,
      data,
    });
  }
  return data;
};

const encode = (params) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(typeof value === "string" ? value : JSON.stringify(value))}`)
    .join("&");

// The entity API reads query and sort as JSON, so sort is serialised even when
// it is a single string like "-rating".
const entityUrl = (entity, params = {}) => {
  const query = encode(params.sort === undefined || params.sort === null ? params : { ...params, sort: JSON.stringify(params.sort) });
  return `/api/entities/${encodeURIComponent(entity)}${query ? `?${query}` : ""}`;
};

const table = (entity) => ({
  filter: (query = {}, options = {}) =>
    request(entityUrl(entity, { query, sort: options.sort, limit: options.limit, skip: options.skip })),
  list: (sort, limit) => request(entityUrl(entity, { sort, limit })),
  get: (id) => request(entityUrl(entity, { id })),
  count: async (query = {}) => (await request(entityUrl(entity, { count: 1, query }))).count,
  create: (data) => request(entityUrl(entity), { method: "POST", body: data }),
  update: (id, data) => request(entityUrl(entity, { id }), { method: "PATCH", body: data }),
  delete: (id) => request(entityUrl(entity, { id }), { method: "DELETE" }),
  bulkCreate: (items = []) => Promise.all(items.map((item) => request(entityUrl(entity), { method: "POST", body: item }))),
  bulkUpdate: (items = []) => Promise.all(items.map((item) => request(entityUrl(entity, { id: item.id }), { method: "PATCH", body: item }))),
  updateMany: (query = {}, data = {}) =>
    request(`${entityUrl(entity)}?op=update-many`, { method: "POST", body: { query, data } }),
  deleteMany: (query = {}) => request(`${entityUrl(entity)}?op=delete-many`, { method: "POST", body: { query } }),
  subscribe: () => () => {},
});

const tables = new Proxy({}, { get: (_target, entity) => table(String(entity)) });

const hasSession = () =>
  typeof document !== "undefined" &&
  document.cookie.split(";").some((part) => part.trim().startsWith("avora_signed_in="));

const sameAppPath = (value) => {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search : "/";
  } catch {
    return "/";
  }
};

const upload = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: form, credentials: "same-origin" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Upload failed");
  return data;
};

export const db = {
  entities: tables,

  auth: {
    hasToken: hasSession,
    me: async () => (await request("/api/auth/me")).user,
    updateMe: async (data) => (await request("/api/auth/me", { method: "PATCH", body: data })).user,
    loginViaEmailPassword: async (email, password) => (await request("/api/auth/login", { method: "POST", body: { email, password } })).user,
    register: async (data) => request("/api/auth/register", { method: "POST", body: data }),
    logout: async (destination = "/login") => {
      await request("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = sameAppPath(destination);
    },
    redirectToLogin: (returnTo = "/") => {
      window.location.href = `/login?returnTo=${encodeURIComponent(sameAppPath(returnTo))}`;
    },
    resetPasswordRequest: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
    resetPassword: ({ resetToken, newPassword }) =>
      request("/api/auth/reset-password", { method: "POST", body: { token: resetToken, password: newPassword } }),
  },

  users: {
    inviteUser: (email) => request("/api/users/invite", { method: "POST", body: { email } }),
  },

  integrations: {
    Core: {
      UploadPublicFile: async ({ file }) => upload(file),
      UploadPrivateFile: async ({ file }) => upload(file),
      CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: file_uri }),
    },
  },

  functions: {
    invoke: async () => ({ data: null }),
  },
};

db.asServiceRole = db;
