import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo, signOut } from "firebase/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Protocole Clear" },
      { name: "description", content: "Reprenez votre protocole là où vous l'avez laissé." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading: authLoading, signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/" });
  }, [user, authLoading, navigate]);

  if (authLoading || user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const info = getAdditionalUserInfo(result);
      if (info?.isNewUser) {
        // Account didn't exist — not a registered client, block immediately
        await signOut(auth);
        setError("Aucun compte trouvé. Contacte ton coach pour recevoir un lien d'accès.");
        return;
      }
      navigate({ to: "/" });
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Une erreur est survenue. Réessaie.");
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      {/* Visual side */}
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.95_0.08_55_/_0.6),transparent_60%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background/80 shadow-soft backdrop-blur">
              <img src="/logo_clear.png" alt="Protocole Clear" className="h-full w-full rounded-full object-cover" />
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight">Protocole Clear</span>
          </Link>
          <div className="max-w-md">
            <Sparkles className="mb-6 h-7 w-7 text-primary" />
            <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground">
              Ta peau se souvient de chaque choix que tu fais.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-foreground/70">
              Bon retour. Reprends ton protocole là où tu l'avais laissé — une peau plus calme se construit rituel après rituel.
            </p>
            <div className="mt-10 flex items-center gap-3">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 w-9 rounded-full border-2 border-background bg-gradient-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/70">
                <span className="font-semibold text-foreground">2,400+</span> people transforming their skin
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
                <img src="/logo_clear.png" alt="Protocole Clear" className="h-full w-full rounded-full object-cover" />
              </div>
              <span className="font-display text-xl font-semibold">Protocole Clear</span>
            </Link>
          </div>

          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Bon retour</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Connexion</h1>
          <p className="mt-2 text-muted-foreground">Continue ta transformation.</p>

          <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/80">Password</label>
                <a href="#" className="text-xs font-medium text-primary hover:underline">Oublié ?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-medium text-background shadow-elegant transition-all hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>Se connecter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-4 text-xs uppercase tracking-wider text-muted-foreground">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm font-medium shadow-soft transition-colors hover:bg-muted disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Continuer avec Google
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Pas encore de compte ? Contacte ton coach pour recevoir un lien d'accès.
          </p>
        </div>
      </div>
    </div>
  );
}
