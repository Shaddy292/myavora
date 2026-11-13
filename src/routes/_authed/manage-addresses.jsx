import { createFileRoute, Navigate } from "@tanstack/react-router";

// Consolidated: the address book now lives at /customer-addresses.
export const Route = createFileRoute("/_authed/manage-addresses")({
  component: () => <Navigate to="/customer-addresses" replace />,
});