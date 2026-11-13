import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Labelled file picker with a preview, used for product photos in vendor forms. */
export default function ImageUploadField({ label = "Photo", value, onChange, className = "" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (url) onChange?.(url);
    } catch (error) {
      toast.error(error?.message || "Could not upload that photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-[11.5px] font-semibold text-[#5B4A6B]">{label}</span>
      <div className="flex items-center gap-2.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F6EEFB] text-[22px] ring-1 ring-[#EFE7F6]">
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-[#9A8CA8]" />}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-[#F8F5FC] px-3 py-2 text-[12px] font-bold text-[#4B2080] ring-1 ring-[#EDE5F4] transition hover:bg-[#F0EAF9] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => onChange?.("")}
              className="flex items-center gap-1 rounded-xl px-2 py-2 text-[11.5px] font-semibold text-[#A11D1D] transition hover:bg-[#FDECEC]"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}
