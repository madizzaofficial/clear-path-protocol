import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  MultiPills,
  Pills,
  Scale,
} from "@/components/questionnaire/QuestionnaireUI";
import {
  ROUTINE_TIME_OPTIONS,
  SPF_FREQUENCY_OPTIONS,
  ADHERENCE_OBSTACLE_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/10-habitudes")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 10 — Protocole Clear" }] }),
  component: Section10,
});

function Section10() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance =
    !!answers.routineTime && !!answers.spfFrequency && answers.routineAdherence > 0;

  function handleNext() {
    if (!canAdvance) return;
    markSection(10);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[10]}` });
  }

  return (
    <QuestionnaireShell step={10} totalSteps={14} title="Habitudes">
      <Section title="Ton mode de vie au quotidien">
        <Field
          label="Combien de temps souhaites-tu consacrer à ta routine matin et soir ?"
          required
        >
          <Pills
            options={ROUTINE_TIME_OPTIONS}
            value={answers.routineTime}
            onChange={(v) => setField("routineTime", v)}
          />
        </Field>
        <Field label="À quelle fréquence appliques-tu une protection solaire ?" required>
          <Pills
            options={SPF_FREQUENCY_OPTIONS}
            value={answers.spfFrequency}
            onChange={(v) => setField("spfFrequency", v)}
          />
        </Field>
        <Field
          label="À quel point penses-tu pouvoir suivre une routine de manière régulière ?"
          required
        >
          <div>
            <Scale
              value={answers.routineAdherence || 0}
              onChange={(v) => setField("routineAdherence", v)}
            />
            <p className="mt-2 text-xs text-muted-foreground">1 = très peu • 10 = tout le temps</p>
          </div>
        </Field>
        <Field label="Qu'est-ce qui risque de t'empêcher de suivre correctement ta routine ?">
          <MultiPills
            options={ADHERENCE_OBSTACLE_OPTIONS}
            values={answers.adherenceObstacles}
            onChange={(v) => setField("adherenceObstacles", v)}
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[8]}`}
      />
    </QuestionnaireShell>
  );
}
