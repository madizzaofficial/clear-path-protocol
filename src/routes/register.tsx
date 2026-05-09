import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Mail, Lock, User, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — Lumen" },
      { name: "description", content: "Begin your skin transformation journey." },
    ],
  }),
  component: RegisterPage,
});

const benefits = [
  "Personalized 12-week protocol",
  "Coach-curated product routine",
  "Track your visible progress",
];

function RegisterPage() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-warm" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,oklch(0.95_0.08_55_/_0.6),transparent_60%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-soft backdrop-blur">
              <span className="font-display text-base font-semibold text-foreground">L</span>
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight">Lumen</span>
          </Link>
          <div className="max-w-md">
            <Sparkles className="mb-6 h-7 w-7 text-primary" />
            <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">
              A protocol designed around the skin you actually have.
            </h2>
            <ul className="mt-8 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-foreground/80">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background/70">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary shadow-soft">
                <span className="text-sm font-semibold text-primary-foreground">L</span>
              </div>
              <span className="font-display text-xl font-semibold">Lumen</span>
            </Link>
          </div>

          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Get started</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-2 text-muted-foreground">Free to start. Your skin will thank you.</p>

          <form className="mt-10 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Full name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Your name"
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@email.com"
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  className="h-12 w-full rounded-2xl border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
              <span>
                I agree to the{" "}
                <a href="#" className="text-foreground underline-offset-2 hover:underline">Terms</a> and{" "}
                <a href="#" className="text-foreground underline-offset-2 hover:underline">Privacy Policy</a>.
              </span>
            </label>

            <button
              type="submit"
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-sm font-medium text-background shadow-elegant transition-all hover:opacity-90"
            >
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-foreground hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
