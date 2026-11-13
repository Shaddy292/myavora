import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Tap-friendly replacement for a native <select>: a bottom drawer on phones,
// the familiar popover list on desktop — same field look in both.
const TRIGGER =
  "mt-1 flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-[12.5px] font-medium text-foreground";

export default function FieldSelect({ id, value, onChange, options, placeholder = "Select", className, ariaLabel }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  if (isMobile) {
    return (
      <>
        <button type="button" id={id} aria-label={ariaLabel} onClick={() => setOpen(true)} className={cn(TRIGGER, className)}>
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[80vh] bg-card">
            <DrawerHeader className="pb-2 text-left">
              <DrawerTitle className="font-display text-[15px] font-bold text-foreground">
                {ariaLabel || placeholder}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition",
                      active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn(TRIGGER, "focus:ring-0 focus:ring-offset-0", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-[12.5px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}