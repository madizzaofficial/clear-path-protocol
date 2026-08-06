import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import { SECTION_SLUGS, SECTIONS } from "@/lib/questionnaire-constants";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Questionnaire — Protocole Clear" }] }),
  component: QuestionnaireIndex,
});

function QuestionnaireIndex() {
  const { user, loading } = useAuth();
  const { answers, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Redirect to first incomplete section (or 1 if none)
    const completed = new Set(answers.completedSections);
    const next = SECTIONS.find((s) => !completed.has(s.id))?.id ?? 1;
    navigate({ to: `/questionnaire/${SECTION_SLUGS[next - 1]}` });
  }, [loading, qLoading, user, answers.completedSections, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
