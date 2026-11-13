import { createStart } from "@tanstack/react-start";
import { functionContextMiddleware, requestContextMiddleware, securityHeadersMiddleware } from "@/lib/auth-middleware";

// Every server function and server route gets `context.getDb()`.
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, requestContextMiddleware],
  functionMiddleware: [functionContextMiddleware],
}));
