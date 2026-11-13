import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import Logo from "@/components/avora/Logo";
import BackButton from "@/components/avora/BackButton";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL } from "@/lib/avora";
import { cn } from "@/lib/utils";

// Root dashboard screens: back-navigation does not apply to these.
const ROOT_PATHS = ["/admin", "/vendor", "/rider"];

export default function ConsoleShell({ nav, active, badge, title, subtitle, actions, children, role }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = !ROOT_PATHS.includes(pathname);

  const navLink = (item, variant) => {
    const isActive = item.key === active;
    return (
      <Link
        key={item.key}
        to={item.to}
        className={cn(
          "flex items-center gap-2 whitespace-nowrap rounded-xl text-[13px] font-semibold transition",
          variant === "side" ? "px-3 py-2.5" : "px-3 py-2",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
      >
        {item.label}
        {typeof item.count === "number" && item.count > 0 && (
          <span
            className={cn(
              "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent text-accent-foreground"
            )}
          >
            {item.count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <Link to="/" className="px-1">
          <Logo className="h-9" />
        </Link>
        <p className="mt-5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{badge}</p>
        <nav className="mt-2 space-y-1">{nav.map((item) => navLink(item, "side"))}</nav>
        <div className="mt-auto rounded-xl bg-muted p-3">
          <p className="truncate text-[12px] font-semibold text-foreground">{user?.full_name || user?.email}</p>
          <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{ROLE_LABEL[role] ?? "Member"}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            {showBack && <BackButton iconOnly className="shrink-0" />}
            <Link to="/" className="lg:hidden">
              <Logo className="h-8" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[17px] font-extrabold tracking-[-0.02em] text-foreground lg:text-[20px]">
                {title}
              </h1>
              {subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) => navLink(item, "tab"))}
          </div>
        </header>
        <main className="px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}