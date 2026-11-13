# AVORA — TanStack Start

AVORA is a full-stack food and grocery delivery app built with
[TanStack Start](https://tanstack.com/start) (React 19, plain JavaScript):
file-based routes, server functions, server routes and server-side rendering.

The app runs entirely on its own Node server. There is no hosted backend and no
third-party platform dependency: data lives in a local JSON store, sessions are
signed cookies, and uploads are written to disk.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Demo account: `demo@avora.app` / `demo1234`.

The database and uploads are created on first run under `.data/`
(`.data/avora.json`, `.data/uploads/`). Delete that folder to reseed the demo
data.

## Build

```bash
npm run build      # -> dist/client (assets) + dist/server (SSR server)
npm run lint
```

### Alternative: static SPA + PHP backend (cPanel)

The same UI also builds as a client-only SPA for the PHP backend in
[`server-php/`](server-php/README.md):

```bash
npm run build:php      # SPA build; server functions swap to RPC stubs (src/rpc/)
npm run package:php    # copy into server-php/public (index.html + assets)
node scripts/preview-php-build.mjs   # local preview, http://localhost:8443
```

See [server-php/README.md](server-php/README.md) for the cPanel deployment
guide. The Node build above is unaffected.

## Run in production

```bash
npm run build      # production client + server bundles into dist/
export AVORA_SECRET="$(openssl rand -hex 32)"   # invalidates existing sessions
npm start          # http://0.0.0.0:3000 (override with PORT / HOST)
```

Copy `.env.example` to `.env` and adjust, or set the variables directly in the
environment:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the production server binds to. |
| `HOST` | `0.0.0.0` | Bind address. |
| `AVORA_SECRET` | generated & stored in `.data/secret` | HMAC key for session cookies. Set explicitly so sessions survive data-dir wipes. |
| `AVORA_DEMO` | `true` | Seed demo data (accounts, stores, menu, orders) on first run. Set `false` for a clean database. |
| `AVORA_DEMO_PASSWORD` | `demo1234` | Password for seeded demo accounts. |
| `AVORA_DATA_DIR` | `.data` | Where the JSON database, uploads and generated secret live. Point it at persistent storage. |
| `AVORA_SECURE_COOKIES` | `false` | Adds the `Secure` cookie flag — enable when serving over HTTPS. |
| `AVORA_GOOGLE_CLIENT_ID` / `AVORA_GOOGLE_CLIENT_SECRET` | — | Enables "Continue with Google" on the login and register pages. In Google Cloud Console, register `https://<your-domain>/api/auth/google/callback` as an authorized redirect URI. Unset = feature off, buttons hidden. |

Production notes:

- Auth endpoints are rate-limited (login, register, password reset, invites) and
  security headers are applied to every response; uploads are restricted to
  image/PDF extensions.
- Client assets are served with long-lived immutable caching. The server bundle
  is plain ESM on Node 20+ with no other runtime dependencies.
- Clean non-demo instance: `AVORA_DEMO=false AVORA_SECRET=<random> npm start`
  with an empty `AVORA_DATA_DIR`.

## How the pieces fit

- **Pages** are files in `src/routes/`. A route's `loader` runs on the server for
  a document request and in the browser for a client navigation;
  `Route.useLoaderData()` gives the component the resolved data.
- **Database** — `src/server/store.server.js`: a JSON-file store with atomic
  writes, query operators (`$in`, `$ne`, `$gt`, …) and patch operators (`$set`,
  `$unset`, `$inc`, `$push`). Tables are seeded from `src/server/seed.js`.
- **Auth** — `src/server/auth.server.js`: scrypt password hashes and an HttpOnly
  `avora_session` cookie signed with a secret generated into `.data/secret`.
  Password reset links are printed to the server console (no mail service).
- **Entity API** — `src/routes/api/entities.$entity.js`: session-required CRUD
  used by the browser client (`src/api/client.js`). Personal tables (addresses,
  payment methods, favorites, notifications) are scoped to the session owner;
  users, rider profiles, orders, refunds and tickets are filtered by ownership
  or admin role, and password hashes are never returned.
- **Auth API** — `src/routes/api/auth.*.js`: login, register, logout, me,
  forgot-password and reset-password.
- **Uploads** — `POST /api/uploads`, served from `GET /api/files/$name`.
- **Server functions** (`src/lib/*-fns.js`) are RPCs created with
  `createServerFn`. `src/start.js` gives every server function and server route
  `context.getDb()` (the store client) and `context.user` (the signed-in user,
  `null` when anonymous). Functions that need a session use `requireUser`.
- **Server-only code** lives in `*.server.js` files (TanStack refuses to bundle
  them for the browser).
- **Secrets** come from `.data/secret` or `process.env`; never expose them under
  `import.meta.env.VITE_*`.
