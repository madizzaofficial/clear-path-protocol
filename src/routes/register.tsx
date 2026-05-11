import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Accès sur invitation — Lumen" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Accès sur invitation</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          L'inscription se fait uniquement via un lien personnalisé envoyé par ton coach. Contacte-le pour recevoir ton accès.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          J'ai déjà un compte → Se connecter
        </Link>
      </div>
    </div>
  );
}
