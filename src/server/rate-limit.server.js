// Small in-memory fixed-window limiter for sensitive endpoints. Per-process
// only — fine for a single-node deployment; put a gateway limiter in front
// when scaling beyond one instance.
const hits = new Map();

const clientIp = (request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
};

export const checkRateLimit = (request, scope, limit, windowMs) => {
  if (hits.size > 20000) {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now >= entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  entry.count += 1;
  if (entry.count <= limit) return null;
  const retryAfter = Math.ceil((entry.reset - now) / 1000);
  return Response.json(
    { error: "Too many attempts. Try again in a few minutes." },
    { status: 429, headers: { "retry-after": String(retryAfter) } }
  );
};
