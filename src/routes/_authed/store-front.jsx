import { createFileRoute, redirect } from "@tanstack/react-router";

// The customer-facing vendor storefront already lives at /store-menu.
export const Route = createFileRoute("/_authed/store-front")({
  beforeLoad: () => {
    throw redirect({ to: "/store-menu" });
  },
});