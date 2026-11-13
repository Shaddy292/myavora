import { Link } from "@tanstack/react-router";
import { ArrowRight, Tag } from "lucide-react";
import { formatNGN } from "@/lib/avora";

/** Promo codes and a shortcut strip of stores on the customer dashboard. */
export default function BrowseShowcase({ stores = [], promos = [] }) {
  if (stores.length === 0 && promos.length === 0) return null;

  return (
    <section className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Popular near you</h2>
          <Link
            to="/store-directory"
            className="flex items-center gap-1 text-[11.5px] font-bold text-[#4B2080] hover:text-[#2B0B4D]"
          >
            See all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {stores.slice(0, 6).map((store) => (
            <li key={store.id}>
              <Link
                to="/store-menu"
                search={{ id: store.id }}
                className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] p-2.5 transition hover:bg-[#F6EEFB]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-[18px] ring-1 ring-[#F1E9F7]">
                  {store.cover_url ? (
                    <img src={store.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">🏪</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[#1B1024]">{store.name}</span>
                  <span className="block truncate text-[11px] text-[#9A8CA8]">
                    {store.rating ?? "—"} ★ · {store.eta_min ?? 20}–{store.eta_max ?? 35} min
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Offers for you</h2>
          <Link to="/promotions" className="flex items-center gap-1 text-[11.5px] font-bold text-[#4B2080] hover:text-[#2B0B4D]">
            All offers <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {promos.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-[#9A8CA8]">No live promo codes right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {promos.slice(0, 4).map((promo) => (
              <li key={promo.id} className="flex items-center gap-3 rounded-xl bg-[#FFF7ED] p-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FF7A00] text-white">
                  <Tag className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold text-[#1B1024]">{promo.code}</span>
                  <span className="block truncate text-[11px] text-[#8B7A9C]">
                    {promo.description ||
                      (promo.discount_type === "percent"
                        ? `${promo.value}% off your order`
                        : `${formatNGN(promo.value)} off`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
