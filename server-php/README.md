# AVORA — PHP Backend (cPanel Edition)

This is a pure-PHP port of the AVORA Node/TanStack Start backend. It serves the
same JSON API (`/api/auth/*`, `/api/entities/*`, `/api/uploads`, `/api/files/*`)
with byte-compatible session cookies, so the same React frontend works against
either backend unchanged.

**Stage 2 (done):** the React app builds as a static SPA for this backend.
`npm run build:php` swaps every `src/lib/*-fns.js` module for a generated RPC
stub in `src/rpc/` that calls `POST /api/fn/<module>/<name>`, so no server-only
code reaches the browser.

**Stage 3 (done):** every server function exported by the Node backend — all
114 across 11 modules (`account`, `admin-ps`, `avora`, `catalog`, `finance`,
`insight`, `jwt`, `order`, `partner-admin`, `platform`, `session`) — is ported
to `server-php/src/fns/` and served by the same RPC endpoint. Each module file
exposes `registry(): array` mapping `'module/name' => ['auth' => bool, 'run' =>
[Class::class, 'method']]`, discovered automatically by `FnApi`. The only
remaining Node-only path is the Google OAuth redirect flow, which needs a
provider callback URL and is not required for cPanel hosting.

## Requirements

- PHP **8.1+** with `pdo_mysql`
- MySQL **5.7+** / MariaDB 10.3+
- Apache with `mod_rewrite` (standard on cPanel)

No Composer packages. No Node.js. Upload and go.

## 1. Create the database (cPanel → MySQL Databases)

1. Create a database, e.g. `cpuser_avora`.
2. Create a user, e.g. `cpuser_avora`, with a strong password.
3. Add the user to the database with **All Privileges**.

## 2. Build and upload the files

From the project root:

```bash
npm run build:php       # SPA build against the PHP backend (RPC stubs, no SSR)
npm run package:php     # copies the build into server-php/public/
```

Then upload the contents of `public/` to your web root (`public_html/` or a
subdomain folder):

```
public_html/
  .htaccess
  index.php
  index.html      ← SPA document (served for every non-API path)
  assets/         ← hashed JS/CSS bundles
  src/            ← required by index.php; see below
  uploads/        ← created automatically; must be writable by PHP
```

`src/` is this package's `server-php/src/`. Two safe options on cPanel:

- **Recommended:** upload `server-php/src/` to `public_html/../avora-src/`
  (one level *above* web root) and change the `require` paths in
  `public/index.php` from `__DIR__ . '/../src/...'` to
  `__DIR__ . '/../../avora-src/...'`.
- **Acceptable for testing:** upload `src/` inside the web root as shown above
  and add a `public_html/src/.htaccess` containing just `Require all denied`
  so it can never be served.

## 3. Configure environment variables

Set these via cPanel → *Select PHP Version* → *Options* → *Additional php.ini
directives*, or your host's environment tool, or `SetEnv` lines in
`.htaccess`:

| Variable | Required | Notes |
|---|---|---|
| `AVORA_DB_HOST` | no | Default `localhost` |
| `AVORA_DB_NAME` | **yes** | e.g. `cpuser_avora` |
| `AVORA_DB_USER` | **yes** | |
| `AVORA_DB_PASS` | **yes** | |
| `AVORA_SECRET` | **yes** | Random 64-char hex; signs session cookies. Generate: `openssl rand -hex 32` |
| `AVORA_DEMO` | no | `true` seeds the demo dataset on first request when the DB is empty. Set `false` for a clean start |
| `AVORA_DEMO_PASSWORD` | no | Password for `demo@avora.app` (default `demo1234`) |
| `AVORA_SECURE_COOKIES` | no | Set `true` once you serve over HTTPS |
| `AVORA_UPLOAD_DIR` | no | Defaults to `<package>/uploads`; override if you moved it |

On cPanel, `SetEnv` in `.htaccess` works for most hosts, e.g.:

```apache
SetEnv AVORA_DB_NAME cpuser_avora
SetEnv AVORA_DB_USER cpuser_avora
SetEnv AVORA_DB_PASS "your-db-password"
SetEnv AVORA_SECRET "64-hex-chars-from-openssl-rand-hex-32"
```

## 4. First request → schema + seed

The schema (`entities` and `rate_limits` tables) is created automatically on
the first request — no phpMyAdmin setup scripts needed. If `AVORA_DEMO=true`
and the database is empty, the demo dataset (8 stores, 45 products, 7 orders,
categories, settings, tickets) is inserted in the same shape as the Node
backend's seed.

## 5. Smoke test (curl)

```bash
BASE=https://your-domain.com

# 1. Health — expect {"ok":true,"backend":"php"}
curl -s $BASE/api/health

# 2. Demo login — expect {"user":{"id":"local-user-demo",...}} + Set-Cookie
curl -s -c jar.txt -X POST $BASE/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@avora.app","password":"demo1234"}'

# 3. Session check — expect the same user
curl -s -b jar.txt $BASE/api/auth/me

# 4. Entity list — expect 8 stores, no password hashes anywhere
curl -s -b jar.txt "$BASE/api/entities/Store" | head -c 400

# 5. Scoping — a second user's addresses must not leak (register, then GET
#    /api/entities/Address and confirm only your own rows appear)

# 6. Unauthorized — expect 401
curl -s $BASE/api/auth/me

# 7. Rate limit — 11 rapid logins from one IP, expect 429 + Retry-After
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"x@y.z","password":"wrong"}'; done

# 8. Security headers present on every response
curl -sI $BASE/api/health | grep -iE 'x-content|x-frame|referrer|permissions'

# 9. Server-function endpoint — home feed (public, expect a JSON result)
curl -s -X POST $BASE/api/fn/catalog/homeFeed \
  -H 'Content-Type: application/json' -d '{}' | head -c 300

# 10. Server-function endpoint — session (expect {"result":null} anonymously)
curl -s -X POST $BASE/api/fn/session/visitor \
  -H 'Content-Type: application/json' -d '{"data":null}'

# 11. Site content + console context (the latter requires the demo session;
#     without -b jar.txt it answers 401)
curl -s -X POST $BASE/api/fn/insight/getSiteContent -H 'Content-Type: application/json' -d '{}'
curl -s -b jar.txt -X POST $BASE/api/fn/avora/getConsoleContext -H 'Content-Type: application/json' -d '{}'

# 12. SPA fallback — a client route answers the app shell, not a 404
curl -s $BASE/login | grep -o '<title>[^<]*</title>'
```

## Local development loop

The backend supports SQLite as well as MySQL, so you can run it locally without
a MySQL install. Use a PHP 8.1+ CLI:

```bash
# terminal 1 — API on :8080
export AVORA_DB_DRIVER=sqlite AVORA_SECRET=devsecret1234567890
php -S 127.0.0.1:8080 -t server-php/public server-php/public/index.php

# terminal 2 — storefront dev server, hitting PHP for every /api call
AVORA_PHP_ORIGIN=http://127.0.0.1:8080 npm run dev:php
```

Sign in with `demo@avora.app` / `demo1234`. The SQLite file
(`server-php/.sqlite/avora.sqlite`, override with `AVORA_DB_FILE`) is created
and seeded on first request; delete it to start over.

## Local preview (no PHP needed)

To look at the packaged SPA against seed data before deploying:

```bash
npm run build:php && npm run package:php
node scripts/preview-php-build.mjs
# http://localhost:8443/        anonymous landing
# http://localhost:8443/?demo=1 signed-in storefront
```

The harness serves the static build with the same fallback rules. Without a
backend it mocks the shell-critical `/api/fn` calls plus the entity API from
`src/server/seed.js` (in memory, so writes are lost on restart) — a preview aid,
not the backend.

To preview the packaged build against the **real** PHP backend, point the
harness at it:

```bash
AVORA_PHP_ORIGIN=http://127.0.0.1:8080 node scripts/preview-php-build.mjs
```

Every `/api/*` request is then proxied through to PHP, so sessions, cookies,
uploads and all 114 server functions behave exactly as they will in production;
only the static files come from the harness. (`AVORA_PHP_ORIGIN` is also read
by `vite.config.js`, which enables the same proxy for `npm run dev:php`.)

## Password migration note

Accounts created on the Node backend used scrypt password hashes, which PHP
cannot verify. Those accounts receive a 403 on login directing them to
**Forgot password** — the reset flow sets a bcrypt hash and signs them in.
New registrations are bcrypt from the start.

## Frontend wiring

`npm run build:php` aliases each `src/lib/*-fns.js` to the client stubs in
`src/rpc/` (generated by `npm run rpc:stubs`). The stubs POST `{ data }` to
`/api/fn/<module>/<name>` and unwrap `{ result }`, so the UI code is unchanged
between backends. The standard Node build (`npm run build`) is untouched.

Still Node-only: the Google OAuth redirect flow (needs a provider callback URL).
Everything else — auth, entities, uploads, and all 114 server functions — is
PHP-native. Parity notes: the ports keep Node's messages, status codes, field
names and defaults, including the scrypt→bcrypt password migration path above.
Two cosmetic deviations are known: month labels come from PHP's ICU data
(en-GB renders "Sept" where Node's Intl gives "Sep"), and functions that Node's
zod schemas capped for length enforce the same cap only on their primary text
fields, not every optional note string.
