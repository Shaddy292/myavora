import { createFileRoute, redirect } from "@tanstack/react-router";

// The admin live map of active orders and riders already lives at /delivery-map.
export const Route = createFileRoute("/_authed/admin-live-map")({
  beforeLoad: () => {
    throw redirect({ to: "/delivery-map" });
  },
});