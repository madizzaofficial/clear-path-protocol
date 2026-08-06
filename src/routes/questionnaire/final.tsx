import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import { SECTIONS } from "@/lib/questionnaire-constants";
import { toast } from "sonner";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/final")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Merci — Protocole Clear" }] }),
  component: QuestionnaireFinal,
});

function QuestionnaireFinal() {
  const { user, loading } = useAuth();
  const { answers, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      const finalAnswers = {
        ...answers,
        completedAt: Date.now(),
        // Derive legacy fields so existing read paths keep working
        skinType: answers.skinType,
        acneTypes: answers.imperfectionTypes,
        intensity:
          answers.botherLevel >= 8 ? "severe" : answers.botherLevel >= 5 ? "moderee" : "legere",
        currentRoutine:
          [answers.morningRoutine, answers.eveningRoutine].filter(Boolean).join(" | ") ||
          "Aucune routine actuelle",
        mainGoal: answers.goals[0] ?? "",
        priorityGoal: answers.priorityGoal,
      };
      await setDoc(doc(db, "intake_answers", user.uid), JSON.parse(JSON.stringify(finalAnswers)), {
        merge: true,
      });
      // Mark user.intakeStatus = "completed"
      await setDoc(doc(db, "users", user.uid), { intakeStatus: "completed" }, { merge: true });
      toast.success("Merci ! Ton questionnaire est envoyé.");
      navigate({ to: "/suivi" });
    } catch (e: unknown) {
      const msg = (e as { message?: string }).message ?? "Erreur inconnue";
      console.error("[questionnaire] final submit error:", e);
      toast.error(`Erreur lors de l'envoi : ${msg}`);
      setSubmitting(false);
    }
  }

  const completedCount = answers.completedSections.length;

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-8 md:pt-12">
      <div className="flex items-center gap-1">
        {Array.from({ length: 14 }, (_, i) => i + 1).map((step) => (
          <div key={step} className="h-1.5 flex-1 rounded-full bg-primary" />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
        14 / 14 étapes
      </p>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mt-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check className="h-8 w-8" />
            </motion.div>
            <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
              Parfait, j'ai désormais les informations nécessaires pour commencer ton analyse.
            </h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              Je vais étudier personnellement ton historique, tes photos, ta routine actuelle, tes
              réactions passées, tes objectifs et ton budget afin de construire une routine
              cohérente et adaptée à ta situation.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
            <p className="mb-4 text-sm font-medium">Récapitulatif</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Tu as complété{" "}
              <strong>
                {completedCount} section{completedCount > 1 ? "s" : ""}
              </strong>{" "}
              sur 14.
            </p>
            <ul className="space-y-2 text-sm">
              {SECTIONS.map((s) => {
                const done = answers.completedSections.includes(s.id);
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-2 ${done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {done ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border" />
                    )}
                    <span>{s.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Vérifie une dernière fois que tes photos sont nettes et que tu as indiqué le nom complet
            de tes produits.
            <br />
            Tu recevras ta routine personnalisée sous 24 heures.
          </p>

          <button
            onClick={handleSubmit}
            disabled={submitting || completedCount === 0}
            className="mt-6 w-full rounded-full bg-foreground py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              "Envoyer mes réponses"
            )}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CenterSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
