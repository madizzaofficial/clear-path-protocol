import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  MultiPills,
  Pills,
} from "@/components/questionnaire/QuestionnaireUI";
import { GOAL_OPTIONS, DURATION_OPTIONS, SECTION_SLUGS } from "@/lib/questionnaire-constants";
import { NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/02-objectifs")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 2 — Protocole Clear" }] }),
  component: Section2,
});

function Section2() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  // PriorityGoal is filtered to user's selected goals
  const priorityOptions = GOAL_OPTIONS.filter((g) => answers.goals.includes(g.value));

  const canAdvance = answers.goals.length > 0 && !!answers.priorityGoal && !!answers.durationAcne;

  function handleNext() {
    if (!canAdvance) return;
    markSection(2);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[2]}` });
  }

  return (
    <QuestionnaireShell step={2} totalSteps={14} title="Tes objectifs">
      <Section title="Ce que tu veux améliorer">
        <Field label="Quel est ton objectif principal ?" required>
          <MultiPills
            options={GOAL_OPTIONS}
            values={answers.goals}
            onChange={(v) => {
              setField("goals", v);
              if (!v.includes(answers.priorityGoal)) setField("priorityGoal", "");
            }}
          />
        </Field>
        {answers.goals.length > 0 && (
          <Field label="Parmi ces objectifs, lequel est ta priorité absolue aujourd'hui ?" required>
            <Pills
              options={priorityOptions}
              value={answers.priorityGoal}
              onChange={(v) => setField("priorityGoal", v)}
            />
          </Field>
        )}
        <Field label="Depuis combien de temps rencontres-tu ces problèmes ?" required>
          <Pills
            options={DURATION_OPTIONS}
            value={answers.durationAcne}
            onChange={(v) => setField("durationAcne", v)}
          />
        </Field>
        <Field label="Décris avec tes propres mots les problèmes que tu rencontres actuellement avec ta peau.">
          <textarea
            value={answers.problemDescription}
            onChange={(e) => setField("problemDescription", e.target.value)}
            placeholder="Explique ce qui te gêne, comment ta peau évolue et ce que tu n'arrives pas à améliorer malgré tes efforts."
            rows={4}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[0]}`}
      />
    </QuestionnaireShell>
  );
}

function CenterSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
