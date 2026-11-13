import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/api/client";
import { Image } from "@/components/ui/image";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";

const INPUT =
  "mt-0 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] text-[#1B1024] outline-none focus:border-[#4B2080]";
const LIMIT = 8;

/** Admin campaign banners: special offers, store promotions and announcements shown on the home page. */
export default function CampaignBanners({ banners, onChange }) {
  const [uploading, setUploading] = useState(null);

  const patch = (index, changes) =>
    onChange(banners.map((banner, i) => (i === index ? { ...banner, ...changes } : banner)));

  const add = () => onChange([...banners, { title: "", body: "", link: "", image_url: "", is_active: true }]);
  const remove = (index) => onChange(banners.filter((_, i) => i !== index));

  const upload = async (index, file) => {
    if (!file) return;
    setUploading(index);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      patch(index, { image_url: file_url });
      toast.success("Banner image added — publish to go live");
    } catch (error) {
      toast.error(error?.message || "Could not upload that image");
    } finally {
      setUploading(null);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
            <ImagePlus className="h-4 w-4 text-[#FF7A00]" /> Campaign banners
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[#9A8CA8]">
            Special offers, store promotions and announcements shown on the home page.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={banners.length >= LIMIT}
          className="flex items-center gap-1.5 rounded-xl bg-[#2B0B4D] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> New banner
        </button>
      </div>

      {banners.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[#E4D9EE] px-3 py-6 text-center text-[12.5px] text-[#8B7A9C]">
          No banners yet. Tap “New banner” to post your first offer or promotion.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {banners.map((banner, index) => (
            <article key={index} className="overflow-hidden rounded-xl ring-1 ring-[#EFE7F6]">
              {banner.image_url ? (
                <Image src={banner.image_url} alt={banner.title || "Promo banner"} className="h-28 w-full" fittingType="fill" />
              ) : (
                <div className="flex h-28 items-center justify-center bg-[linear-gradient(135deg,#2B0B4D_0%,#5B1478_100%)] px-3 text-center text-[11.5px] font-semibold text-white/70">
                  Text banner — no image
                </div>
              )}
              <div className="space-y-1.5 p-2.5">
                <input
                  value={banner.title ?? ""}
                  onChange={(event) => patch(index, { title: event.target.value })}
                  placeholder="Headline — e.g. 20% off all groceries"
                  className={INPUT}
                />
                <input
                  value={banner.body ?? ""}
                  onChange={(event) => patch(index, { body: event.target.value })}
                  placeholder="Short line — e.g. Today only, until 9pm"
                  className={INPUT}
                />
                <input
                  value={banner.link ?? ""}
                  onChange={(event) => patch(index, { link: event.target.value })}
                  placeholder="Link — e.g. /store-directory or /store/abc123"
                  className={INPUT}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B4A6B]">
                    <input
                      type="checkbox"
                      checked={banner.is_active !== false}
                      onChange={(event) => patch(index, { is_active: event.target.checked })}
                      className="h-3.5 w-3.5 rounded border-[#E4D9EE]"
                    />
                    Live
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-[#F4EEFA] px-2 py-1 text-[11px] font-bold text-[#3B0A66]">
                      {uploading === index ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                      {banner.image_url ? "Replace" : "Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => upload(index, event.target.files?.[0])}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#A11D1D]"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}