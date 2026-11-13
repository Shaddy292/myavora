import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sessionUserFromRequest } from "@/server/auth.server.js";

// The signed-in visitor, or null for anonymous requests. Used by pages that
// render differently for each audience (e.g. "/" is a landing page for
// visitors and the storefront for signed-in customers).
export const visitor = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  return request ? sessionUserFromRequest(request) : null;
});
