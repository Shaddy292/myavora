import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, ChevronDown, User } from "lucide-react";
import Logo from "./Logo";
import DeliverToPicker from "./DeliveryToPicker";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { formatAddress, readDeliveryAddress, saveDeliveryAddress } from "@/lib/delivery";

export default function TopBar({ address, onChangeAddress }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  // Keep the label in step with whatever address is picked anywhere in the app.
  useEffect(() => {
    const sync = () => setSelected(readDeliveryAddress());
    sync();
    window.addEventListener("avora:delivery", sync);
    return () => window.removeEventListener("avora:delivery", sync);
  }, []);

  // First visit after signing in: fall back to the address marked as default.
  useEffect(() => {
    if (!user?.email || readDeliveryAddress()) return;
    let active = true;
    db.entities.Address.list("-created_date", 30)
      .then((result) => {
        const list = Array.isArray(result) ? result : result?.items ?? [];
        const preferred = list.find((row) => row.is_default) ?? list[0];
        if (active && preferred) saveDeliveryAddress(preferred);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.email]);

  const label = address ?? (selected ? formatAddress(selected) : "Select your address");

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
        <Logo className="shrink-0" />

        <button
          type="button"
          onClick={() => (onChangeAddress ? onChangeAddress() : setOpen(true))}
          aria-label={`Deliver to ${label}`}
          className="ml-2 flex min-w-0 items-center gap-1.5 rounded-full bg-card px-3 py-2 text-left shadow-[0_1px_3px_rgba(43,11,77,0.08)] ring-1 ring-border transition hover:ring-primary/40 md:ml-6"
        >
          <MapPin className="h-4 w-4 shrink-0 text-[#FF7A00]" strokeWidth={2.4} />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Deliver to
            </span>
            <span className="block max-w-[150px] truncate text-[13px] font-semibold text-foreground md:max-w-[260px]">
              {label}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>

        <Link
          to={user ? "/dashboard" : "/login"}
          className="ml-auto flex items-center gap-2 rounded-full bg-primary px-3.5 py-2.5 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 md:px-4"
        >
          <User className="h-4 w-4" strokeWidth={2.2} />
          {user ? "My account" : "Sign in"}
        </Link>
      </div>

      <DeliverToPicker
        open={open}
        onOpenChange={setOpen}
        selectedId={selected?.id}
        onSelect={setSelected}
      />
    </header>
  );
}