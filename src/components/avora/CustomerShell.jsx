import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { db } from "@/api/client";
import Logo from "@/components/avora/Logo";
import BackButton from "@/components/avora/BackButton";
import BottomNav from "@/components/avora/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { CUSTOMER_NAV } from "@/lib/console-nav";
import { cn } from "@/lib/utils";

const NAV = CUSTOMER_NAV.map((item) => ({ to: item.to, label: item.label }));
// Top-level tabs: no back arrow, the bottom nav is the way out of these.
const ROOT_TABS = ["/", "/checkout", "/order-history", "/profile", "/dashboard"];

export default function CustomerShell({ children }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRootTab = ROOT_TABS.includes(pathname);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    if (!user?.email) {
      setUnread(0);
      return () => { active = false; };
    }
    db.entities.Notification.count({ user_email: user.email, is_read: false })
      .then((value) => {
        if (active) setUnread(Number(value) || 0);
      })
      .catch(() => {
        if (active) setUnread(0);
      });
    return () => {
      active = false;
    };
  }, [user?.email, pathname]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 md:gap-4 md:px-6">
          {!isRootTab && <BackButton iconOnly className="shrink-0" />}
          <Link to="/">
            <Logo className="h-9" />
          </Link>
          <nav className="ml-auto hidden min-w-0 items-center gap-1 overflow-x-auto sm:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition",
                  pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-2">
            <span className="hidden max-w-[150px] truncate text-[12px] font-semibold text-muted-foreground md:block">
              {user?.full_name || user?.email}
            </span>
            <Link
              to="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition hover:text-foreground"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-[17px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border transition hover:text-destructive"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-6 md:pb-8 md:pt-8">{children}</main>
      <BottomNav homeTo="/dashboard" />
    </div>
  );
}