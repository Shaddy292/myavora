import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { getDb } from "@/server/db-client.server.js";
import { sessionUserFromRequest } from "@/server/auth.server.js";
import { applySecurityHeaders } from "@/server/security.server.js";

const visitor = () => sessionUserFromRequest(getRequest());

// Adds the baseline security headers to every response (dev server path; the
// production entry applies the same headers around static assets too).
export const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  const response = await next();
  // In the production SSR pipeline `next()` may resolve without a headers
  // bag; the production entry (server.js) applies the same headers instead.
  if (response?.headers) applySecurityHeaders(response.headers);
  return response;
});

// Every server function and server route gets `context.getDb()`, the local
// database client. Functions that need the caller add `requireUser`.
export const requestContextMiddleware = createMiddleware({ type: "request" }).server(({ next }) =>
  next({ context: { getDb, user: visitor() } }),
);

export const functionContextMiddleware = createMiddleware({ type: "function" }).server(({ next }) =>
  next({ context: { getDb } }),
);

// Rejects anonymous callers and sets `context.user`:
//   createServerFn().middleware([requireUser]).handler(({ context }) => context.user.id)
export const requireUser = createMiddleware({ type: "function" }).server(({ next }) => {
  const user = visitor();
  if (!user) {
    setResponseStatus(401);
    throw Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" });
  }
  return next({ context: { user } });
});

// The same for a server route: `server: { middleware: [requireUserRoute], handlers }`
// answers anonymous callers with 401 and sets `context.user`.
export const requireUserRoute = createMiddleware({ type: "request" }).server(({ next }) => {
  const user = visitor();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return next({ context: { user } });
});
