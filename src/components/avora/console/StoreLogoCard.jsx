import { useRef, useState } from "react";
import { toast } from "sonner";
import { Image } from "@/components/ui/image";
import { uploadImage } from "@/lib/upload";
import { Camera, Loader2, Store, Trash2 } from "lucide-react";

/** Store logo card — the vendor attaches or replaces the logo from their device. */
export default function StoreLogoCard({ store, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onChange(await uploadImage(file));
      toast.success("Store logo updated");
    } catch (error) {
      toast.error(error?.message || "Could not upload that logo");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    try {
      await onChange("");
      toast.success("Store logo removed");
    } catch (error) {
      toast.error(error?.message || "Could not remove the logo");
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F6EEFB] ring-1 ring-[#EFE7F6] transition hover:ring-[#4B2080]"
        aria-label="Upload store logo"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#4B2080]" />
        ) : store.logo_url ? (
          <Image src={store.logo_url} alt={`${store.name} logo`} className="h-full w-full" fittingType="fill" />
        ) : (
          <Store className="h-6 w-6 text-[#B5A7C2]" />
        )}
        {!busy && (
          <span className="absolute inset-0 hidden items-center justify-center bg-[#2B0B4D]/55 text-white group-hover:flex">
            <Camera className="h-4 w-4" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Store logo</h2>
        <p className="text-[11.5px] text-[#9A8CA8]">Shown on your storefront and next to your name across AVORA.</p>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-[#2B0B4D] px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-[#3B0A66]"
          >
            {store.logo_url ? "Change logo" : "Upload logo"}
          </button>
          {store.logo_url && (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-[11.5px] font-bold text-[#B5A7C2] transition hover:text-[#A11D1D]"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
    </section>
  );
}