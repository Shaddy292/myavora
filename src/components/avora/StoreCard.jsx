import { Star, Clock, Bike } from "lucide-react";
import { Image } from "@/components/ui/image";

export default function StoreCard({ store }) {
  return (
    <article className="group cursor-pointer overflow-hidden rounded-[26px] bg-card shadow-[0_1px_2px_rgba(43,11,77,0.06)] ring-1 ring-border transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_45px_-24px_rgba(43,11,77,0.45)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {store.cover ?
        <Image
          src={store.cover}
          alt={store.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" /> :

        <div className="flex h-full w-full items-center justify-center bg-muted text-[38px]">
            🏪
          </div>
        }
        {store.promo && (
          <span className="absolute left-3 top-3 rounded-full bg-[#FF7A00] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm">
            {store.promo}
          </span>
        )}
        <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-[11px] font-bold text-foreground shadow-sm backdrop-blur">
          <Clock className="h-3 w-3 text-[#1F7A4C]" strokeWidth={2.6} />
          {store.eta}
        </span>
      </div>

      <div className="space-y-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-foreground">
            {store.name}
          </h3>
          <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-secondary-foreground">
            <Star className="h-3 w-3 fill-[#FFB020] text-[#FFB020]" />
            {store.rating}
          </span>
        </div>
        <p className="truncate text-[12.5px] text-muted-foreground">{store.cuisine}</p>
        <div className="flex items-center gap-1 pt-0.5 text-[12px] font-semibold text-foreground">
          <Bike className="h-3.5 w-3.5 text-[#FF7A00]" strokeWidth={2.4} />
          {store.fee}
        </div>
      </div>
    </article>
  );
}