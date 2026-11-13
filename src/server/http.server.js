// Small response helpers shared by the auth and upload routes.
export const jsonWithCookies = (data, cookies = [], init = {}) => {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  cookies.forEach((value) => headers.append("set-cookie", value));
  return new Response(JSON.stringify(data), { ...init, headers });
};

// Response.redirect() only takes (url, status) — a 302 that must also set
// cookies needs a hand-built response.
export const redirectWithCookies = (location, cookies = [], status = 302) => {
  const headers = new Headers({ location });
  cookies.forEach((value) => headers.append("set-cookie", value));
  return new Response(null, { status, headers });
};

export const failure = (error) => {
  const status = error?.status || 500;
  if (status >= 500) console.error("[avora] request failed:", error);
  const message = status >= 500 ? "Internal server error" : error?.message || "Request failed";
  return Response.json({ error: message }, { status });
};
