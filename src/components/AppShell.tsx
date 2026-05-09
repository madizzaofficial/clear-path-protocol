import { Link, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, ShieldCheck, Bell, User, Settings, LogOut, UserCircle, CreditCard, HelpCircle, Check } from "lucide-react";
import { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/course", label: "Protocol", icon: BookOpen },
  { to: "/products", label: "Routine", icon: Sparkles },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

const notifications = [
  { id: 1, title: "New lesson unlocked", body: "Layering Without Irritation is now available.", time: "2h ago", unread: true },
  { id: 2, title: "Routine reminder", body: "Don't forget your evening retinoid tonight.", time: "5h ago", unread: true },
  { id: 3, title: "Coach left a note", body: "Your week 3 photos look great — keep going!", time: "Yesterday", unread: false },
];

function NotificationsMenu() {
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-border/60 p-0 shadow-elegant">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <p className="font-display text-base font-semibold">Notifications</p>
          <button className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Check className="h-3 w-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto border-t border-border/60">
          {notifications.map((n) => (
            <button
              key={n.id}
              className="flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/60"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-transparent"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground/80">{n.time}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-border/60 p-2">
          <button className="w-full rounded-xl py-2 text-center text-xs font-medium text-foreground hover:bg-muted">
            View all notifications
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft outline-none ring-offset-2 transition-all hover:ring-2 hover:ring-primary/30">
          <User className="h-4 w-4 text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/60 p-0 shadow-elegant">
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
            SM
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Sarah Moreau</p>
            <p className="truncate text-xs text-muted-foreground">sarah@email.com</p>
          </div>
        </div>
        <div className="mx-3 mb-2 rounded-xl bg-primary-soft/60 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-primary">Week 3 of 12</p>
          <p className="mt-0.5 text-xs text-foreground/80">Clear Skin Protocol</p>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem className="cursor-pointer rounded-lg py-2">
            <UserCircle className="mr-2 h-4 w-4" /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer rounded-lg py-2">
            <CreditCard className="mr-2 h-4 w-4" /> Subscription
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer rounded-lg py-2">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer rounded-lg py-2">
            <HelpCircle className="mr-2 h-4 w-4" /> Help center
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-destructive focus:text-destructive">
            <Link to="/login">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
              <NotificationsMenu />
              <UserMenu />
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
