import { createFileRoute, redirect } from "@tanstack/react-router";

// The support staff hub already lives at /support-tickets.
export const Route = createFileRoute("/_authed/support-portal")({
  beforeLoad: () => {
    throw redirect({ to: "/support-tickets" });
  },
});