import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  Pills,
  PhotoUpload,
} from "@/components/questionnaire/QuestionnaireUI";
import { ROUTINE_DURATION_OPTIONS, SECTION_SLUGS } from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/06-routine")({
  head: () => ({ meta: [{ title: "Section 6 — Protocole Clear" }] }),
  component: Section6,
});

function Section6() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.routineDuration;

  function handleNext() {
    if (!canAdvance) return;
    markSection(6);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[6]}` });
  }

  return (
    <QuestionnaireShell step={6} totalSteps={14} title="Routine actuelle">
      <Section title="Ce que tu mets sur ta peau au quotidien">
        <Field label="Décris ta routine actuelle du matin dans l'ordre exact d'application.">
          <textarea
            value={answers.morningRoutine}
            onChange={(e) => setField("morningRoutine", e.target.value)}
            placeholder="Indique la marque et le nom complet de chaque produit."
            rows={4}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Décris ta routine actuelle du soir dans l'ordre exact d'application.">
          <textarea
            value={answers.eveningRoutine}
            onChange={(e) => setField("eveningRoutine", e.target.value)}
            placeholder="Indique la marque et le nom complet de chaque produit."
            rows={4}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Utilises-tu certains produits seulement quelques fois par semaine ?">
          <textarea
            value={answers.occasionalProducts}
            onChange={(e) => setField("occasionalProducts", e.target.value)}
            placeholder="Exfoliant, masque, rétinoïde, peeling, traitement local, etc."
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Depuis combien de temps suis-tu cette routine ?" required>
          <Pills
            options={ROUTINE_DURATION_OPTIONS}
            value={answers.routineDuration}
            onChange={(v) => setField("routineDuration", v)}
          />
        </Field>
        <PhotoUpload
          label="Téléverse une photo nette de tous les produits que tu possèdes actuellement (jusqu'à 3)."
          multiple
          value={answers.productPhotos}
          onChange={(v) => setField("productPhotos", v as string[])}
        />
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[4]}`}
      />
    </QuestionnaireShell>
  );
}
