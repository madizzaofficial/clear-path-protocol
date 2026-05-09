import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, ShieldCheck, Bell, User } from "lucide-react";
import { ReactNode } from "react";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/course", label: "Protocol", icon: BookOpen },
  { to: "/products", label: "Routine", icon: Sparkles },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onLesson = path.startsWith("/lesson");

  return (
    <div className="min-h-screen bg-background">
      {!onLesson && (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
                <span className="text-sm font-semibold text-primary-foreground">L</span>
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">Lumen</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {nav.map((n) => {
                const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <button className="rounded-full p-2 text-muted-foreground hover:bg-muted">
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
                <User className="h-4 w-4 text-foreground" />
              </div>
            </div>
          </div>
        </header>
      )}
      {children}
      {!onLesson && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {nav.map((n) => {
              const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
