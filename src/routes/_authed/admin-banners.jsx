import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import Denied from "@/components/avora/console/Denied";
import CampaignBanners from "@/components/avora/admin/CampaignBanners";
import { ADMIN_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { getSiteContent, saveSiteContent } from "@/lib/insight-fns";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authed/admin-banners")({
  loader: async () => {
    const [context, content] = await Promise.all([getConsoleContext(), getSiteContent()]);
    return { context, content };
  },
  head: () => ({ meta: [{ title: "Marketing banners · AVORA admin" }] }),
  component: AdminBanners,
});

function AdminBanners() {
  const { context, content } = Route.useLoaderData();
  const router = useRouter();
  const save = useServerFn(saveSiteContent);
  const [banners, setBanners] = useState(content?.banners ?? []);
  const [busy, setBusy] = useState(false);

  if (context.role !== "admin") {
    return (
      <ConsoleShell nav={ADMIN_NAV} active="banners" badge="Operations" title="Marketing banners" role={context.role}>
        <Denied />
      </ConsoleShell>
    );
  }

  const publish = async () => {
    setBusy(true);
    try {
      await save({ data: { ...content, banners } });
      toast.success("Homepage banners published");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not publish your banners");
    } finally {
      setBusy(false);
    }
  };

  const live = banners.filter((banner) => banner.is_active !== false && (banner.image_url || banner.title)).length;

  return (
    <ConsoleShell
      nav={ADMIN_NAV}
      active="banners"
      badge="Operations"
      title="Marketing banners"
      subtitle={`${live} of ${banners.length} banners live on the home screen`}
      role={context.role}
      actions={
        <button
          type="button"
          onClick={publish}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-[#2B0B4D] px-4 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          <Megaphone className="h-3.5 w-3.5" /> {busy ? "Publishing…" : "Publish banners"}
        </button>
      }
    >
      <CampaignBanners banners={banners} onChange={setBanners} />
      <p className="mt-3 rounded-xl bg-[#FFF6EA] px-4 py-3 text-[12px] leading-relaxed text-[#8A5200] ring-1 ring-[#FBE3C4]">
        Banners appear directly under the home screen categories, strongest offer first. Turn a banner off to hide it
        without deleting the artwork — remember to publish after editing.
      </p>
    </ConsoleShell>
  );
}