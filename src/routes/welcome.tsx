import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Bienvenue — Protocole Clear" }] }),
  component: WelcomePage,
});

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale", grasse: "Grasse", seche: "Sèche", mixte: "Mixte", sensible: "Sensible",
};

const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "Comédons", papules: "Papules / Pustules", microkystes: "Microkystes", kystes: "Kystes / Nodules",
};

const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère", moderee: "Modérée", severe: "Sévère",
};

type IntakeAnswers = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
};

function WelcomePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }

    Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "intake_answers", user.uid)),
    ]).then(([userSnap, intakeSnap]) => {
      if (userSnap.exists() && userSnap.data().welcomeSeen) {
        navigate({ to: "/" });
        return;
      }
      if (intakeSnap.exists()) setIntake(intakeSnap.data() as IntakeAnswers);
      setDoc(doc(db, "users", user.uid), { welcomeSeen: true }, { merge: true }).catch(() => {});
      setChecking(false);
    });
  }, [user, authLoading, navigate]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = user?.displayName?.split(" ")[0] ?? "toi";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary">
            <img src="/logo_clear.png" alt="Protocole Clear" className="h-full w-full rounded-full object-cover" />
          </div>
          <span className="font-display text-lg font-semibold">Protocole Clear</span>
        </div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Passer →
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-20 pt-8">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-elegant">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">C'est parti</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Ton protocole est prêt,<br />{firstName}.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            12 semaines. Une peau plus calme, plus saine, durablement.
          </p>
        </div>

        {/* Skin profile */}
        {intake && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="border-b border-border/60 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ton profil peau
              </p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                {intake.skinType && (
                  <span className="rounded-full bg-gradient-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                    Peau {SKIN_TYPE_LABELS[intake.skinType] ?? intake.skinType}
                  </span>
                )}
                {intake.intensity && (
                  <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
                    Acné {INTENSITY_LABELS[intake.intensity] ?? intake.intensity}
                  </span>
                )}
              </div>
              {(intake.acneTypes?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {intake.acneTypes!.map((t) => (
                    <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                      {ACNE_TYPE_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>
              )}
              {intake.currentRoutine && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Routine actuelle : <span className="font-medium text-foreground">{intake.currentRoutine}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3-pillar overview */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon="📚"
            title="Le protocole"
            body="18 leçons vidéo pour comprendre et traiter ta peau en profondeur."
          />
          <FeatureCard
            icon="🧴"
            title="Ta routine"
            body="Ton coach construit une routine AM/PM sur-mesure pour ta peau."
          />
          <FeatureCard
            icon="📷"
            title="Le journal"
            body="Photos hebdomadaires pour mesurer ta transformation dans le temps."
          />
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/lesson/$lessonId"
            params={{ lessonId: "l-1" }}
            className="inline-flex items-center gap-3 rounded-full bg-foreground px-8 py-3.5 text-base font-semibold text-background shadow-elegant transition-all hover:opacity-90"
          >
            Commencer la leçon 1 <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Tu peux revenir à tout moment depuis le menu.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 font-display text-base font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
