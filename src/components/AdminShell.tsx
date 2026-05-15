import { Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { LayoutDashboard, Link2, Package, BookOpen, Apple } from "lucide-react";

const TABS = [
  { label: "Dashboard",          to: "/admin",               icon: LayoutDashboard },
  { label: "Liens d'invitation", to: "/admin/tokens",         icon: Link2 },
  { label: "Catalogue",          to: "/admin/products",       icon: Package },
  { label: "Cours",              to: "/admin/course-editor",  icon: BookOpen },
  { label: "Nutrition",          to: "/admin/nutrition",      icon: Apple },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppShell>
      <div className="sticky top-[57px] z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex items-center justify-between gap-0.5 py-2 sm:justify-start">
            {TABS.map((tab) => {
              const isActive = tab.to === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-medium transition-colors sm:flex-none sm:justify-start sm:px-4 sm:whitespace-nowrap ${
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </AppShell>
  );
}
