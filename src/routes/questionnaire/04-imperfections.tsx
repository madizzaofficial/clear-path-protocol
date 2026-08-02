import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  MultiPills,
  Scale,
} from "@/components/questionnaire/QuestionnaireUI";
import {
  ACNE_LOCATION_OPTIONS,
  IMPERFECTION_TYPE_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/04-imperfections")({
  head: () => ({ meta: [{ title: "Section 4 — Protocole Clear" }] }),
  component: Section4,
});

function Section4() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance =
    answers.acneLocations.length > 0 &&
    answers.imperfectionTypes.length > 0 &&
    answers.botherLevel > 0;

  function handleNext() {
    if (!canAdvance) return;
    markSection(4);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[4]}` });
  }

  return (
    <QuestionnaireShell step={4} totalSteps={14} title="Imperfections & marques">
      <Section title="Où et comment se manifestent tes imperfections">
        <Field label="Où sont principalement situées tes imperfections ?" required>
          <MultiPills
            options={ACNE_LOCATION_OPTIONS}
            values={answers.acneLocations}
            onChange={(v) => setField("acneLocations", v)}
          />
        </Field>
        <Field label="Quels types d'imperfections ou de marques observes-tu ?" required>
          <MultiPills
            options={IMPERFECTION_TYPE_OPTIONS}
            values={answers.imperfectionTypes}
            onChange={(v) => setField("imperfectionTypes", v)}
          />
        </Field>
        <Field label="À quel point l'état actuel de ta peau te gêne-t-il ?" required>
          <div>
            <Scale value={answers.botherLevel || 0} onChange={(v) => setField("botherLevel", v)} />
            <p className="mt-2 text-xs text-muted-foreground">1 = très peu • 10 = énormément</p>
          </div>
        </Field>
        <Field label="Qu'est-ce qui te dérange le plus lorsque tu regardes ta peau ?">
          <textarea
            value={answers.mainBother}
            onChange={(e) => setField("mainBother", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[2]}`}
      />
    </QuestionnaireShell>
  );
}
