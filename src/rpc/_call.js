// Transport for the PHP backend's server-function port. Every /api/fn
// request is a same-origin POST with the JSON body { data } and answers
// { result } on success or { error } with a 4xx/5xx status on failure.
// Errors keep the same shape the TanStack server functions threw (Error with
// a `status`), so existing try/catch and route error handling still work.

export async function callFn(module, name, data) {
  let response;
  try {
    response = await fetch(`/api/fn/${module}/${name}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: data ?? null }),
    });
  } catch {
    throw Object.assign(new Error("The server could not be reached — check your connection."), { status: 0 });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || `Request failed (${response.status})`), {
      status: response.status,
    });
  }
  return payload.result;
}
