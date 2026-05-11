import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, ShieldCheck, Bell, User, LogOut, UserCircle, Camera, Check } from "lucide-react";
import { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

const notifications = [
  { id: 1, title: "Nouvelle leçon disponible", body: "\"Superposition sans irritation\" est maintenant accessible.", time: "il y a 2h", unread: true },
  { id: 2, title: "Rappel routine", body: "N'oublie pas ton rétinoïde du soir ce soir.", time: "il y a 5h", unread: true },
  { id: 3, title: "Note de ton coach", body: "Tes photos de la semaine 3 sont top — continue !", time: "Hier", unread: false },
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
            <Check className="h-3 w-3" /> Tout marquer lu
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
            Voir toutes les notifications
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

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
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.displayName ?? "Mon compte"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
            <Link to="/profile">
              <UserCircle className="mr-2 h-4 w-4" /> Mon profil
            </Link>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer rounded-lg py-2 text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onLesson = path.startsWith("/lesson");
  const { isAdmin } = useAuth();

  const nav = [
    { to: "/", label: "Accueil", icon: Home },
    { to: "/course", label: "Protocole", icon: BookOpen },
    { to: "/products", label: "Routine", icon: Sparkles },
    { to: "/journal", label: "Journal", icon: Camera },
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {!onLesson && (
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo_clear.png" alt="Protocole Clear" className="h-20 w-20 rounded-full object-cover" />
              <span className="font-display text-xl font-semibold tracking-tight">Protocole Clear</span>
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
