import { useEffect } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Receipt, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";

// Each tab owns a branch of routes: a nested page (e.g. /customer-addresses) still
// lights up its tab, and tapping that tab returns to the branch root.
const ITEMS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  {
    to: "/order-history",
    label: "Orders",
    icon: Receipt,
    branches: ["/order-history", "/order-details", "/order-tracking", "/live-tracking"],
  },
  { to: "/checkout", label: "Basket", icon: ShoppingBag, branches: ["/checkout"] },
  {
    to: "/profile",
    label: "Account",
    icon: User,
    branches: [
      "/profile",
      "/customer-addresses",
      "/manage-addresses",
      "/saved-addresses",
      "/payment-methods",
      "/refund-management",
      "/help-center",
      "/notifications",
      "/favorites",
    ],
  },
];

const MEMORY_KEY = "avora:tab-branches";

const inBranch = (item, pathname) =>
  item.exact ? pathname === item.to : (item.branches ?? []).some((path) => pathname === path || pathname.startsWith(`${path}/`));

// The nested path each tab was last on, so switching away and back keeps the sub-stack.
const readBranches = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(MEMORY_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const writeBranches = (memory) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Storage disabled (private WebView): tab memory simply stays in-memory for this tap.
  }
};

export default function BottomNav({ homeTo = "/" }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { count } = useCart();
  const items = ITEMS.map((item, index) => (index === 0 ? { ...item, to: homeTo } : item));

  useEffect(() => {
    const tab = items.find((item) => inBranch(item, pathname));
    if (!tab) return;
    const memory = readBranches();
    if (pathname === tab.to) {
      if (memory[tab.to]) {
        delete memory[tab.to];
        writeBranches(memory);
      }
      return;
    }
    if (memory[tab.to] !== pathname) writeBranches({ ...memory, [tab.to]: pathname });
  }, [pathname]);

  const onTabClick = (event, item) => {
    const { to } = item;
    const isActive = inBranch(item, pathname);
    const memory = readBranches();

    if (isActive) {
      event.preventDefault();
      if (pathname !== to) {
        // Nested page inside this tab: go back to the tab's root route.
        if (memory[to]) {
          delete memory[to];
          writeBranches(memory);
        }
        navigate({ to, replace: true });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Returning to a tab restores the nested page it was left on.
    const remembered = memory[to];
    if (remembered && remembered !== to) {
      event.preventDefault();
      navigate({ to: remembered });
    }
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="flex items-stretch">
        {items.map((item) => {
          const { to, label, icon: Icon } = item;
          const isActive = inBranch(item, pathname);
          return (
            <Link
              key={to}
              to={to}
              onClick={(event) => onTabClick(event, item)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide transition",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.4 : 1.9} />
              {label}
              {to === "/checkout" && count > 0 && (
                <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[9px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}