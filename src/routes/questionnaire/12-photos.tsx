import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  PhotoUpload,
} from "@/components/questionnaire/QuestionnaireUI";
import { SECTION_SLUGS } from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/12-photos")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 12 — Protocole Clear" }] }),
  component: Section12,
});

function Section12() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.photoFront && !!answers.photoLeft && !!answers.photoRight;

  function handleNext() {
    if (!canAdvance) return;
    markSection(12);
    // Combine all photo URLs into photoUrls meta
    const allUrls = [
      answers.photoFront,
      answers.photoLeft,
      answers.photoRight,
      ...answers.photoExtras,
    ].filter(Boolean);
    setField("photoUrls", allUrls);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[12]}` });
  }

  return (
    <QuestionnaireShell
      step={12}
      totalSteps={14}
      title="Photos de ton visage"
      intro="Les photos sont indispensables pour que je puisse observer la répartition des imperfections, les rougeurs, les marques et l'état général de ta peau."
    >
      <Section
        title="Instructions"
        intro="Prends-les de préférence en lumière naturelle, sans filtre, sans maquillage et avec le visage propre. Évite le mode portrait et les photos prises trop loin."
      >
        <PhotoUpload
          label="Photo de face"
          required
          value={answers.photoFront}
          onChange={(v) => setField("photoFront", v as string)}
        />
        <PhotoUpload
          label="Photo du profil gauche"
          required
          value={answers.photoLeft}
          onChange={(v) => setField("photoLeft", v as string)}
        />
        <PhotoUpload
          label="Photo du profil droit"
          required
          value={answers.photoRight}
          onChange={(v) => setField("photoRight", v as string)}
        />
        <PhotoUpload
          label="Photos supplémentaires des zones qui te préoccupent (optionnel)"
          multiple
          value={answers.photoExtras}
          onChange={(v) => setField("photoExtras", v as string[])}
        />
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[10]}`}
      />
    </QuestionnaireShell>
  );
}
