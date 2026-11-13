import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { signAccessToken } from "@/lib/jwt.server";

// Mints a 15-minute HS256 access token for the signed-in user.
export const issueAccessToken = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { token, payload, expires_in } = await signAccessToken({
      sub: context.user.id,
      email: context.user.email,
      role: context.user.role || "user",
    });
    return {
      access_token: token,
      token_type: "Bearer",
      expires_in,
      expires_at: new Date(payload.exp * 1000).toISOString(),
    };
  });