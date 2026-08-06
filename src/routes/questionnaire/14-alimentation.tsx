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
  DIET_BALANCE_OPTIONS,
  FOOD_FREQUENCY_OPTIONS,
  SUPPLEMENT_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/14-alimentation")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 14 — Protocole Clear" }] }),
  component: Section14,
});

const YES_NO_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

function Section14() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.dietBalance && !!answers.takesSupplements;

  function handleNext() {
    if (!canAdvance) return;
    markSection(14);
    navigate({ to: "/questionnaire/final" });
  }

  return (
    <QuestionnaireShell
      step={14}
      totalSteps={14}
      title="Alimentation & compléments"
      intro="L'état de la peau ne dépend pas uniquement des produits que tu appliques. Cette section me permet d'identifier certains facteurs alimentaires ou compléments qui pourraient influencer tes imperfections ou tes rougeurs."
    >
      <Section title="Cette section reste courte et ne dépasse pas 2 minutes.">
        <Field label="Comment décrirais-tu globalement ton alimentation ?" required>
          <Pills
            options={DIET_BALANCE_OPTIONS}
            value={answers.dietBalance}
            onChange={(v) => setField("dietBalance", v)}
          />
        </Field>
        <Field label="Consommes-tu ces aliments ?">
          <MultiPills
            options={FOOD_FREQUENCY_OPTIONS}
            values={answers.foodFrequency}
            onChange={(v) => setField("foodFrequency", v)}
          />
        </Field>
        <Field label="Prends-tu actuellement des compléments alimentaires ?" required>
          <Pills
            options={YES_NO_OPTIONS}
            value={answers.takesSupplements}
            onChange={(v) => {
              setField("takesSupplements", v);
              if (v === "non") {
                setField("supplementsList", []);
                setField("supplementsDuration", "");
              }
            }}
          />
        </Field>
        {answers.takesSupplements === "oui" && (
          <>
            <Field label="Quels compléments prends-tu actuellement ?">
              <MultiPills
                options={SUPPLEMENT_OPTIONS}
                values={answers.supplementsList}
                onChange={(v) => setField("supplementsList", v)}
              />
            </Field>
            <Field label="Depuis combien de temps prends-tu ces compléments ?">
              <textarea
                value={answers.supplementsDuration}
                onChange={(e) => setField("supplementsDuration", e.target.value)}
                placeholder="Ex : Créatine depuis 2 ans, Whey depuis 6 mois..."
                rows={2}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </>
        )}
        <Field label="As-tu déjà remarqué qu'un aliment ou un complément semblait aggraver ton acné ou tes rougeurs ?">
          <textarea
            value={answers.foodAggravates}
            onChange={(e) => setField("foodAggravates", e.target.value)}
            placeholder="Par exemple : produits laitiers, whey, sucre, fast-food, alcool, ou tout autre aliment ou complément."
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[12]}`}
        nextLabel="Terminer"
      />
    </QuestionnaireShell>
  );
}
