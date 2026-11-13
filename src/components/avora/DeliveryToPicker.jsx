import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, MapPin, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import { saveDeliveryAddress } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export default function DeliverToPicker({ open, onOpenChange, selectedId, onSelect }) {
  const { user, isLoadingAuth, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user?.email) return;
    let active = true;
    setLoading(true);
    db.entities.Address.list("-created_date", 30)
      .then((result) => {
        if (active) setAddresses(Array.isArray(result) ? result : result?.items ?? []);
      })
      .catch(() => {
        if (active) setAddresses([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user?.email]);

  const choose = (address) => {
    saveDeliveryAddress(address);
    onSelect?.(address);
    onOpenChange(false);
  };

  const goToBook = () => {
    onOpenChange(false);
    if (user) navigate({ to: "/customer-addresses" });
    else navigateToLogin();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 rounded-2xl p-0">
        <DialogHeader className="border-b border-border px-4 py-3.5 text-left">
          <DialogTitle className="font-display text-[16px] font-bold text-foreground">Where should we deliver?</DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Pick a saved address, or add a new one to your address book.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your addresses…
            </div>
          )}

          {!loading && !addresses.length && (
            <div className="px-2 py-6 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <p className="mt-2.5 text-[13px] font-semibold text-foreground">
                {user ? "No saved addresses yet" : "Sign in to use your addresses"}
              </p>
              <p className="mx-auto mt-1 max-w-[280px] text-[11.5px] text-muted-foreground">
                {user
                  ? "Add your street, area and phone number once and checkout fills itself in."
                  : "Your saved addresses and delivery details follow your account."}
              </p>
            </div>
          )}

          {addresses.map((address) => {
            const active = address.id === selectedId;
            return (
              <button
                key={address.id}
                type="button"
                onClick={() => choose(address)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left transition",
                  active ? "bg-secondary" : "hover:bg-muted"
                )}
              >
                <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-[#FF7A00]")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">
                    {address.label}
                    {address.is_default && (
                      <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                        Default
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {[address.line1, address.area].filter(Boolean).join(", ")}
                  </span>
                </span>
                {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="border-t border-border px-3 py-3">
          <button
            type="button"
            onClick={goToBook}
            disabled={isLoadingAuth}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {user ? "Add or manage addresses" : "Sign in to add an address"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}