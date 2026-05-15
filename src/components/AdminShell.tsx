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
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-0.5 overflow-x-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const isActive = tab.to === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
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
