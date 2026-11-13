import { createFileRoute, redirect } from "@tanstack/react-router";

// The geofenced delivery-zone map already lives at /delivery-zones.
export const Route = createFileRoute("/_authed/admin-delivery-zones")({
  beforeLoad: () => {
    throw redirect({ to: "/delivery-zones" });
  },
});