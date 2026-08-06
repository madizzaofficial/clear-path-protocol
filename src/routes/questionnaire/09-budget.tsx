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
} from "@/components/questionnaire/QuestionnaireUI";
import {
  BUDGET_OPTIONS,
  PRODUCTS_PREFERENCE_OPTIONS,
  PURCHASE_CHANNEL_OPTIONS,
  CONSTRAINT_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/09-budget")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 9 — Protocole Clear" }] }),
  component: Section9,
});

function Section9() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.budget && !!answers.productsPreference;

  function handleNext() {
    if (!canAdvance) return;
    markSection(9);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[9]}` });
  }

  return (
    <QuestionnaireShell step={9} totalSteps={14} title="Budget & préférences">
      <Section title="Pour t'orienter vers les produits les plus adaptés">
        <Field label="Quel budget total souhaites-tu consacrer à l'achat de ta routine ?" required>
          <Pills
            options={BUDGET_OPTIONS}
            value={answers.budget}
            onChange={(v) => setField("budget", v)}
          />
        </Field>
        <Field label="Quelle est ta préférence concernant tes produits actuels ?" required>
          <Pills
            options={PRODUCTS_PREFERENCE_OPTIONS}
            value={answers.productsPreference}
            onChange={(v) => setField("productsPreference", v)}
          />
        </Field>
        <Field label="Où préfères-tu acheter tes produits ?">
          <MultiPills
            options={PURCHASE_CHANNEL_OPTIONS}
            values={answers.purchaseChannels}
            onChange={(v) => setField("purchaseChannels", v)}
          />
        </Field>
        <Field label="As-tu des contraintes ou des préférences particulières ?">
          <MultiPills
            options={CONSTRAINT_OPTIONS}
            values={answers.constraints}
            onChange={(v) => setField("constraints", v)}
          />
        </Field>
        <Field label="Y a-t-il des marques que tu refuses d'utiliser ou que tu préfères particulièrement ?">
          <textarea
            value={answers.brandPreferences}
            onChange={(e) => setField("brandPreferences", e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[7]}`}
      />
    </QuestionnaireShell>
  );
}
