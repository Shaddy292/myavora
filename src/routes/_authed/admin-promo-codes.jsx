import { createFileRoute, redirect } from "@tanstack/react-router";

// Promo code management (create, limits, expiry, redemption) already lives at /promo-codes.
export const Route = createFileRoute("/_authed/admin-promo-codes")({
  beforeLoad: () => {
    throw redirect({ to: "/promo-codes" });
  },
});
