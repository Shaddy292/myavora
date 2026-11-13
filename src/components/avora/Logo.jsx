import { cn } from "@/lib/utils";
import lockupUrl from "@/assets/avora-lockup.png";
import markUrl from "@/assets/avora-mark.png";

// The official AVORA brand assets (transparent PNGs).
export default function Logo({ className = "" }) {
  return (
    <img
      src={lockupUrl}
      alt="AVORA"
      className={cn("h-9 w-auto", className)}
    />
  );
}

export function LogoMark({ className = "" }) {
  return (
    <img
      src={markUrl}
      alt="AVORA"
      className={cn("h-12 w-auto", className)}
    />
  );
}
