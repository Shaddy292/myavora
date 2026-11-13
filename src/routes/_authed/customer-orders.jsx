import { createFileRoute, redirect } from "@tanstack/react-router";

// Full order history, receipts and reorder already live at /order-history.
export const Route = createFileRoute("/_authed/customer-orders")({
  beforeLoad: () => {
    throw redirect({ to: "/order-history" });
  },
});