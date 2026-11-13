import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowDown, Loader2 } from "lucide-react";

const TRIGGER = 64;

// Pull down from the top of a page to re-run its loader. Touch only, so
// desktop behaviour is untouched.
export default function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distance = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let startY = null;

    const reset = () => {
      distance.current = 0;
      setPull(0);
    };

    const onStart = (event) => {
      if (busy.current || window.scrollY > 0 || event.touches.length !== 1) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
    };

    const onMove = (event) => {
      if (startY === null || busy.current) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0 || window.scrollY > 0) {
        reset();
        return;
      }
      distance.current = Math.min(delta * 0.5, 88);
      setPull(distance.current);
    };

    const onEnd = async () => {
      startY = null;
      if (busy.current || distance.current < TRIGGER) {
        reset();
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPull(TRIGGER);
      try {
        await router.invalidate();
      } finally {
        busy.current = false;
        setRefreshing(false);
        reset();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  if (!refreshing && pull <= 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
    >
      <div
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-bold text-[#3B0A66] shadow-[0_10px_24px_-12px_rgba(43,11,77,0.45)] ring-1 ring-[#EFE6F6] transition-transform"
        style={{ transform: `translateY(${refreshing ? 0 : Math.max(pull - TRIGGER, 0)}px)` }}
      >
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowDown
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: `rotate(${pull >= TRIGGER ? 180 : 0}deg)` }}
          />
        )}
        {refreshing ? "Refreshing…" : pull >= TRIGGER ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
  );
}