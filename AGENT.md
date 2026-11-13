# AGENTS.md

## Project Context

This is the AVORA repository, a **TanStack Start** app (React 19, plain
JavaScript — no TypeScript): file-based routes, server functions, server routes
and server-side rendering. It runs on a plain Node server with no hosted
backend: a local JSON store (`.data/avora.json`), cookie sessions and
filesystem uploads (`.data/uploads/`). Treat it as user-owned application code,
keep changes focused on the user's request, and preserve the conventions below.

See `README.md` for setup and the architecture overview.

## Key Files

- `src/routes/__root.jsx`: the HTML document (`<html>`, `<head>` via
  `HeadContent`, `<Scripts />`) and the providers. There is **no `index.html`**.
- `src/routes/*.jsx`: one page per file (`index.jsx` → `/`,
  `posts.$id.jsx` → `/posts/$id`). Gated pages live under `_authed/`.
  `src/routes/api/*.js`: server routes (raw HTTP endpoints).
  `src/routeTree.gen.ts` is generated on every dev/build run — never edit it.
- `src/server/store.server.js`: the JSON store (`entities` with
  filter/get/create/update/delete/updateMany/…). Writes are atomic
  (temp file + rename) and throttled for 25 ms.
- `src/server/seed.js`: demo data and `DEMO_USER`. The demo password is
  `demo1234` and is hashed lazily on first access.
- `src/server/auth.server.js`: scrypt hashing, the signed `avora_session`
  cookie, register/authenticate/setPassword/reset tokens/invite helpers and
  `sessionUserFromRequest` / `sessionHeaders`.
- `src/server/scoped.server.js`: owner-scoped tables for personal data
  (`Address`, `PaymentMethod`, `Favorite`, `Notification`) and `userDb(email)`.
- `src/server/db-client.server.js`: `context.getDb()` — the store client used
  by server functions and server routes. `tableFor(entity, user)` applies
  per-user scoping.
- `src/api/client.js`: the browser client. Entities go over HTTP to
  `/api/entities/*`; auth goes to `/api/auth/*`.
- `src/lib/auth-middleware.js`: `requestContextMiddleware` and
  `functionContextMiddleware` (set `context.getDb` + `context.user`),
  `requireUser`, `requireUserRoute`, and `securityHeadersMiddleware`
  (applies the headers from `src/server/security.server.js` in dev).
- `src/server/config.server.js`: all environment-driven config (`PORT`,
  `HOST`, `AVORA_SECRET`, `AVORA_DEMO`, `AVORA_DEMO_PASSWORD`,
  `AVORA_DATA_DIR`, `AVORA_SECURE_COOKIES`) — read config here, never
  scattered `process.env` reads.
- `src/server/rate-limit.server.js`: fixed-window in-memory limiter;
  `checkRateLimit(request, scope, limit, windowMs)` guards the auth routes.
- `src/server/oauth.server.js`: Google sign-in (OAuth 2.0) — consent URL,
  signed state cookie, code exchange and profile fetch. Enabled only when
  `AVORA_GOOGLE_CLIENT_ID`/`AVORA_GOOGLE_CLIENT_SECRET` are set; the
  `/api/auth/providers` endpoint tells the client whether to show the button.
- `server.js` (repo root): the production entry — srvx server that serves
  `dist/client` statically and `dist/server/server.js` for everything else.
- `src/lib/AuthContext.jsx`: client-side session (`useAuth()`); the session is
  read through `/api/auth/me`.
- `src/components/auth/`: the login, register and password-reset pages.
- `src/components/ui/`: shadcn/ui kit (JSX). `src/index.css` +
  `tailwind.config.js`: design tokens.
- `vite.config.js`: `tanstackStart()`, `react()` and the `@` → `src` alias.
  Keep `PREBUNDLE` and the alias. With `--mode php` (or `AVORA_TARGET=php`) it
  enables SPA mode and aliases every `src/lib/*-fns.js` import to the generated
  RPC stub of the same name in `src/rpc/`.
- `src/rpc/`: generated client stubs (`npm run rpc:stubs` regenerates them from
  the fns modules; never edit by hand) plus `_call.js`, which POSTs `{ data }`
  to `/api/fn/<module>/<name>` and unwraps `{ result }`. Only used by the PHP
  build target.
- `server-php/`: the pure-PHP backend for cPanel (PHP 8.1+, PDO MySQL, no
  Composer). `public/index.php` is the front controller; `src/` holds the store,
  auth, entity API, uploads, rate limit and `FnApi.php` (the `/api/fn`
  registry). `npm run build:php && npm run package:php` copies the SPA build
  into `server-php/public/`. See `server-php/README.md` for deployment.
- `scripts/`: `gen-rpc-stubs.mjs` (RPC stub generator), `package-php.mjs`
  (SPA → server-php/public) and `preview-php-build.mjs` (seed-backed local
  preview of the packaged SPA when PHP is unavailable).

## Data and Sessions

- All tables live in `.data/avora.json`. There is no migration system: a missing
  target file is seeded from `src/server/seed.js`. Delete `.data/` to reseed.
- Personal tables are always read and written through
  `db.as(email)` / `db.tableFor(entity, user)`. Never import `entities`
  directly in a route handler — use `context.getDb()` so the request-scoped
  client and per-user scoping stay intact.
- The cookie is `HttpOnly` and signed; `hasSession()` in the browser reads the
  separate readable `avora_signed_in` marker. Signing out clears both.
- Password reset tokens are single-use and printed to the server console; there
  is no email transport.

## Server Security

- Every server function and server route is a public HTTP endpoint: anyone can
  call it directly, with any input, without going through your pages. A page's
  `beforeLoad`, redirect or hidden button protects nothing on the server.
- Server functions that need a signed-in caller add `.middleware([requireUser])`
  and check ownership or role before reading or changing records.
- Server routes under `src/routes/api/` use `sessionUserFromRequest(request)` and
  answer 401 when there is no session; `requireUserRoute` does the same when
  added to `server.middleware`.
- Never return `password_hash`, reset tokens or other account secrets. The
  entity API strips them centrally — keep it that way.
- Browser entity access is filtered per table: personal tables by `user_email`;
  `User`, `RiderProfile`, `Order`, `Refund` and `SupportTicket` by ownership or
  admin role. Admin pages reach the same data through server functions instead.
- Validate input with zod where the caller controls it; never trust ids, emails
  or roles sent by the client. Bound string and array sizes.
- Uploads: `POST /api/uploads` caps files at 8 MB and stores them under
  `.data/uploads/`; files are served by `GET /api/files/$name`.

## Working Notes

- `npm run dev` runs the TanStack dev server (Vite) on Node.
- `npm run build` emits `dist/client` (static assets) and `dist/server` (the SSR
  server). Never commit either.
- Data flows through the router: `loader` + `Route.useLoaderData()` for reads,
  `useServerFn` + TanStack Query mutations for writes. The router creates the
  `QueryClient` per request (`src/router.jsx`); never share one across requests.
- Server and first client render must match: read `window`, `document` and
  browser storage only in effects and handlers, and format dates and numbers
  with an explicit locale and time zone.
- `ssr: false` only on pages that need the signed-in user, so personal data
  never lands in cached HTML.
- Run `npm run lint` before finishing code changes. Write JavaScript/JSX only —
  no `.ts`/`.tsx` files (the generated `src/routeTree.gen.ts` is the sole
  exception and is never hand-edited).

