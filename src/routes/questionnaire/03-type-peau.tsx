import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  Pills,
  MultiPills,
} from "@/components/questionnaire/QuestionnaireUI";
import {
  SKIN_TYPE_OPTIONS,
  SENSITIVITY_OPTIONS,
  SKIN_REACTION_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/03-type-peau")({
  head: () => ({ meta: [{ title: "Section 3 — Protocole Clear" }] }),
  component: Section3,
});

function Section3() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance =
    !!answers.skinType && !!answers.sensitivity && answers.skinReactions.length > 0;

  function handleNext() {
    if (!canAdvance) return;
    markSection(3);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[3]}` });
  }

  return (
    <QuestionnaireShell step={3} totalSteps={14} title="Type de peau & sensibilité">
      <Section title="Comment se comporte ta peau">
        <Field
          label="Comment décrirais-tu ta peau sans produits dessus, quelques heures après l'avoir nettoyée ?"
          required
        >
          <Pills
            options={SKIN_TYPE_OPTIONS}
            value={answers.skinType}
            onChange={(v) => setField("skinType", v)}
          />
        </Field>
        <Field label="Dirais-tu que ta peau est sensible ou réactive ?" required>
          <Pills
            options={SENSITIVITY_OPTIONS}
            value={answers.sensitivity}
            onChange={(v) => setField("sensitivity", v)}
          />
        </Field>
        <Field label="Comment ta peau réagit-elle habituellement ?" required>
          <MultiPills
            options={SKIN_REACTION_OPTIONS}
            values={answers.skinReactions}
            onChange={(v) => setField("skinReactions", v)}
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[1]}`}
      />
    </QuestionnaireShell>
  );
}
