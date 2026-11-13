import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Square product thumbnail; clicking it (unless readOnly) uploads a new photo. */
export default function ProductImageCell({ product, onUploaded, readOnly = false, className = "" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (url) onUploaded?.(url);
    } catch (error) {
      toast.error(error?.message || "Could not upload that photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => !readOnly && inputRef.current?.click()}
        disabled={readOnly || busy}
        title={readOnly ? product?.name : "Change photo"}
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F6EEFB] text-[20px] ring-1 ring-[#EFE7F6]",
          !readOnly && "transition hover:ring-[#D9C6EA]",
          className
        )}
      >
        {product?.image_url ? (
          <img src={product.image_url} alt={product.name || ""} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{product?.emoji || "🛍️"}</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-4 w-4 animate-spin text-[#4B2080]" />
          </span>
        )}
        {!readOnly && !busy && (
          <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#2B0B4D] text-white">
            <Camera className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
      {!readOnly && <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />}
    </>
  );
}
