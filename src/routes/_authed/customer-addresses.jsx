import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/api/client";
import CustomerShell from "@/components/avora/CustomerShell";
import AddressBook from "@/components/avora/addresses/AddressBook";

export const Route = createFileRoute("/_authed/customer-addresses")({
  loader: async () => ({ addresses: await db.entities.Address.list("-created_date", 30) }),
  head: () => ({ meta: [{ title: "Address book · AVORA" }] }),
  component: CustomerAddresses,
});

function CustomerAddresses() {
  const { addresses } = Route.useLoaderData();
  return (
    <CustomerShell>
      <AddressBook addresses={addresses} />
    </CustomerShell>
  );
}