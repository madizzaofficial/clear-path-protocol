import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, BookOpen, Sparkles, ShieldCheck, User, LogOut, UserCircle, Camera, Moon, Sun, HelpCircle, FlaskConical, Bell } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { AdminBell } from "@/components/AdminBell";


function UserMenu() {
  const { user, signOut, isAdmin, accountType } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  const isRestricted = accountType === "routine_only";

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
          <DropdownMenuItem onClick={toggle} className="cursor-pointer rounded-lg py-2">
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === "dark" ? "Mode clair" : "Mode sombre"}
          </DropdownMenuItem>
          {!isRestricted && (
            <>
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
                <Link to="/ingredient-analyzer">
                  <FlaskConical className="mr-2 h-4 w-4" /> Analyseur INCI
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
                <Link to="/profile">
                  <UserCircle className="mr-2 h-4 w-4" /> Mon profil
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {isAdmin && (
            <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2">
              <Link to="/admin/notifications">
                <Bell className="mr-2 h-4 w-4" /> Notifications
              </Link>
            </DropdownMenuItem>
          )}
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
  const isNavigating = useRouterState({ select: (s) => s.isLoading });
  const { isAdmin, accountType } = useAuth();

  const isRestricted = accountType === "routine_only";

  const nav = [
    { to: "/products", label: "Routine", icon: Sparkles },
    { to: "/journal", label: "Journal", icon: Camera },
    ...(isRestricted
      ? []
      : [
          { to: "/suivi", label: "Suivi", icon: Home },
          { to: "/course", label: "Protocole", icon: BookOpen },
          { to: "/faq", label: "FAQ", icon: HelpCircle },
        ]),
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ] as const;

  const homeTo = isRestricted ? "/products" : "/suivi";

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {isNavigating && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-muted">
          <div className="h-full animate-[progress_1s_ease-in-out_infinite] bg-primary" />
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to={homeTo} className="flex items-center gap-2">
            <img src="/logo_clear.png" alt="" className="h-20 w-20 rounded-full object-cover" />
            <span className="font-display text-xl font-semibold tracking-tight">Protocole Clear</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = path.startsWith(n.to);
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
            {isAdmin && <AdminBell />}
            <UserMenu />
          </div>
        </div>
      </header>
      {children}
      {(
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {nav.map((n) => {
              const active = path.startsWith(n.to);
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
