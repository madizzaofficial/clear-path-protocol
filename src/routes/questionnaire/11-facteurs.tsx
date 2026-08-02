import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  MultiPills,
  Pills,
} from "@/components/questionnaire/QuestionnaireUI";
import {
  AGGRAVATING_FACTOR_OPTIONS,
  PIMPLE_TOUCHING_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/11-facteurs")({
  head: () => ({ meta: [{ title: "Section 11 — Protocole Clear" }] }),
  component: Section11,
});

function Section11() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = answers.aggravatingFactors.length > 0 && !!answers.pimpleTouching;

  function handleNext() {
    if (!canAdvance) return;
    markSection(11);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[11]}` });
  }

  return (
    <QuestionnaireShell step={11} totalSteps={14} title="Facteurs qui influencent ta peau">
      <Section title="Ce qui peut aggraver ou améliorer ta peau">
        <Field label="Quels facteurs semblent aggraver l'état de ta peau ?" required>
          <MultiPills
            options={AGGRAVATING_FACTOR_OPTIONS}
            values={answers.aggravatingFactors}
            onChange={(v) => setField("aggravatingFactors", v)}
          />
        </Field>
        <Field label="À quelle fréquence touches-tu ou perces-tu tes boutons ?" required>
          <Pills
            options={PIMPLE_TOUCHING_OPTIONS}
            value={answers.pimpleTouching}
            onChange={(v) => setField("pimpleTouching", v)}
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[9]}`}
      />
    </QuestionnaireShell>
  );
}
