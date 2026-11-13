import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { db } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import CustomerShell from "@/components/avora/CustomerShell";
import BrowseShowcase from "@/components/avora/dashboard/BrowseShowcase";
import StatusPill from "@/components/avora/StatusPill";
import EmptyState from "@/components/avora/EmptyState";
import { ACTIVE_STATUSES, formatNGN, formatDateTime } from "@/lib/avora";
import { Bike, Store, Headphones, Plus, MapPin, Trash2 } from "lucide-react";
import { getConsoleContext } from "@/lib/avora-fns";

export const Route = createFileRoute("/_authed/dashboard")({
  loader: async () => {
    const user = await db.auth.me();
    const [orders, addresses, context, stores, promos] = await Promise.all([
      db.entities.Order.filter({ customer_email: user.email }, { sort: "-created_date", limit: 20 }),
      db.entities.Address.list("-created_date", 20),
      getConsoleContext(),
      db.entities.Store.filter({ is_approved: true }, { sort: "-rating", limit: 4 }),
      db.entities.PromoCode.filter({ is_active: true }, { sort: "-created_date", limit: 3 }),
    ]);
    return {
      orders: orders.items ?? orders,
      addresses,
      context,
      stores: stores.items ?? stores,
      promos: promos.items ?? promos,
    };
  },
  head: () => ({ meta: [{ title: "Your dashboard · AVORA" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { orders, addresses, context, stores, promos } = Route.useLoaderData();
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ label: "", line1: "", area: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const active = orders.find((o) => ACTIVE_STATUSES.includes(o.status));
  const firstName = (user?.full_name || "").split(" ")[0] || "there";

  const addAddress = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.entities.Address.create(form);
      setForm({ label: "", line1: "", area: "", phone: "" });
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (id) => {
    await db.entities.Address.delete(id);
    await router.invalidate();
  };

  return (
    <CustomerShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF7A00]">Your account</p>
          <h1 className="font-display mt-1 text-[26px] font-extrabold tracking-[-0.03em] text-[#1B1024]">
            Hi {firstName}, hungry?
          </h1>
          <p className="text-[13px] text-[#8B7A9C]">Order food, track deliveries and manage your addresses.</p>
        </div>
        <Link
          to="/store-directory"
          className="rounded-full bg-[#2B0B4D] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#3B0A66]"
        >
          Browse stores
        </Link>
      </div>

      {active && (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A8CA8]">Live order</p>
              <p className="font-display text-[16px] font-bold text-[#1B1024]">
                {active.store_name} · {active.code}
              </p>
            </div>
            <StatusPill status={active.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-[#5B4A6B]">
            <span>{active.items?.length ?? 0} items · {formatNGN(active.total)}</span>
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-[#FF7A00]" />
              {active.rider_name || "Matching a rider"}
            </span>
            <span>{formatDateTime(active.created_date)}</span>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/store-menu", label: "Order food", icon: Store, hint: "Browse store menus" },
          { to: "/vendor", label: "Vendor console", icon: Store, hint: "Sell on AVORA" },
          { to: "/rider", label: "Rider console", icon: Bike, hint: "Deliver & earn" },
          { to: "/support", label: "Support", icon: Headphones, hint: "We reply fast" },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6] transition hover:-translate-y-0.5 hover:ring-[#D9C6EA]"
          >
            <item.icon className="h-5 w-5 text-[#4B2080]" />
            <p className="mt-2 text-[13.5px] font-bold text-[#1B1024]">{item.label}</p>
            <p className="text-[11.5px] text-[#9A8CA8]">{item.hint}</p>
          </Link>
        ))}
      </div>

      <BrowseShowcase stores={stores} promos={promos} />

      <section className="mt-7 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Recent orders</h2>
          {orders.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                title="No orders yet"
                description="Your first AVORA order will show up here with live tracking."
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[#F3ECF9]">
              {orders.slice(0, 6).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[#1B1024]">{order.store_name}</p>
                    <p className="text-[11.5px] text-[#9A8CA8]">
                      {order.code} · {formatDateTime(order.created_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[13px] font-bold text-[#2B0B4D]">{formatNGN(order.total)}</span>
                    <StatusPill status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[16px] font-bold text-[#1B1024]">Saved addresses</h2>
          <ul className="mt-3 space-y-2">
            {addresses.map((address) => (
              <li key={address.id} className="flex items-start justify-between gap-2 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[12.5px] font-bold text-[#1B1024]">
                    <MapPin className="h-3.5 w-3.5 text-[#FF7A00]" /> {address.label}
                  </p>
                  <p className="truncate text-[11.5px] text-[#8B7A9C]">
                    {address.line1}
                    {address.area ? `, ${address.area}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAddress(address.id)}
                  className="shrink-0 text-[#B5A7C2] transition hover:text-[#A11D1D]"
                  aria-label={`Remove ${address.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {addresses.length === 0 && (
              <li className="text-[12px] text-[#9A8CA8]">Add your first delivery address below.</li>
            )}
          </ul>

          <form onSubmit={addAddress} className="mt-3 space-y-2">
            {[
              { key: "label", placeholder: "Label (Home, Office)" },
              { key: "line1", placeholder: "Street address" },
              { key: "area", placeholder: "Area (Yaba)" },
              { key: "phone", placeholder: "Phone" },
            ].map((field) => (
              <input
                key={field.key}
                required={field.key !== "phone"}
                value={form[field.key]}
                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2 text-[12.5px] outline-none focus:border-[#4B2080]"
              />
            ))}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF7A00] px-3 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              {busy ? "Saving…" : "Add address"}
            </button>
          </form>
        </div>
      </section>

      {context.store && (
        <p className="mt-6 text-[11.5px] text-[#9A8CA8]">
          You own <strong className="text-[#2B0B4D]">{context.store.name}</strong> on AVORA — open the vendor console to
          manage it.
        </p>
      )}
    </CustomerShell>
  );
}