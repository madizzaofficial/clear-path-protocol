import { Link, useRouterState } from "@tanstack/react-router";
import { AppShell } from "./AppShell";
import { LayoutDashboard, Link2, Package, BookOpen, Apple, ClipboardList, ShieldCheck, LayoutTemplate } from "lucide-react";

const TABS = [
  { label: "Dashboard",          to: "/admin",               icon: LayoutDashboard },
  { label: "Liens d'invitation", to: "/admin/tokens",         icon: Link2 },
  { label: "Catalogue",          to: "/admin/products",       icon: Package },
  { label: "Routines",           to: "/admin/routines",       icon: ClipboardList },
  { label: "Modèles",            to: "/admin/templates",      icon: LayoutTemplate },
  { label: "Cours",              to: "/admin/course-editor",  icon: BookOpen },
  { label: "Nutrition",          to: "/admin/nutrition",      icon: Apple },
  { label: "Admins",             to: "/admin/admins",          icon: ShieldCheck },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppShell>
      <div className="sticky top-[57px] z-30 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex items-center gap-0.5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => {
              const isActive = tab.to === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
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
