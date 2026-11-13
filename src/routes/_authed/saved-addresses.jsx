import { createFileRoute, Navigate } from "@tanstack/react-router";

// Consolidated: addresses now live at /manage-addresses.
export const Route = createFileRoute("/_authed/saved-addresses")({
  component: () => <Navigate to="/manage-addresses" replace />,
});