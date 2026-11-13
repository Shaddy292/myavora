// Production entry: serves the built SSR handler and the static client
// assets on a plain Node server. Run `npm run build` first, then `npm start`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "srvx/node";
import { staticMiddleware } from "srvx/static";
import entry from "./dist/server/server.js";
import { applySecurityHeaders } from "./src/server/security.server.js";

const handler = typeof entry === "function" ? entry : entry.fetch;

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || "0.0.0.0";

serve({
  port,
  hostname,
  middleware: [
    async (request, next) => {
      const response = await next();
      applySecurityHeaders(response.headers);
      return response;
    },
    // Every file in dist/client is content-hashed, so it can be cached hard.
    staticMiddleware({ dir: path.join(root, "dist/client"), maxAge: 86400, immutable: true }),
  ],
  fetch: handler,
});

console.log(`[avora] production server listening on http://${hostname}:${port}`);
