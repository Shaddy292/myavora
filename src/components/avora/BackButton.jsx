import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Child-screen navigation: goes back through the browser history, and falls
// back to a known parent route when there is nothing to go back to.
export default function BackButton({ label = "Back", fallbackTo = "/", className, iconOnly = false }) {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.history.back();
      return;
    }
    router.navigate({ to: fallbackTo });
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-card text-[12px] font-bold text-foreground ring-1 ring-border transition hover:text-[#FF7A00]",
        iconOnly ? "h-9 w-9 justify-center" : "px-3 py-1.5",
        className
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </button>
  );
}