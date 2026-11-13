import { createFileRoute } from "@tanstack/react-router";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import VendorApply from "@/components/avora/console/VendorApply";
import StoreProfileForm from "@/components/avora/vendor/StoreProfileForm";
import { VENDOR_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";

export const Route = createFileRoute("/_authed/vendor-store-settings")({
  loader: async () => ({ context: await getConsoleContext() }),
  head: () => ({ meta: [{ title: "Store settings · AVORA" }] }),
  component: VendorStoreSettings,
});

function VendorStoreSettings() {
  const { context } = Route.useLoaderData();
  const store = context.store;

  return (
    <ConsoleShell
      nav={VENDOR_NAV}
      active="storeSettings"
      badge="Vendor console"
      title="Store settings"
      subtitle="Name, logo, tagline and preparation times"
      role={context.role}
    >
      {store ? (
        <StoreProfileForm store={store} />
      ) : (
        <div className="mx-auto max-w-2xl">
          <VendorApply />
        </div>
      )}
    </ConsoleShell>
  );
}