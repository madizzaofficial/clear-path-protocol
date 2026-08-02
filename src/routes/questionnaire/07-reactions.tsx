import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  Pills,
} from "@/components/questionnaire/QuestionnaireUI";
import { SECTION_SLUGS } from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/07-reactions")({
  head: () => ({ meta: [{ title: "Section 7 — Protocole Clear" }] }),
  component: Section7,
});

const HAD_REACTION_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "je_sais_pas", label: "Je ne sais pas" },
];

function Section7() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.hadReaction;

  function handleNext() {
    if (!canAdvance) return;
    markSection(7);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[7]}` });
  }

  return (
    <QuestionnaireShell step={7} totalSteps={14} title="Réactions & expériences">
      <Section title="Les produits qui t'ont fait du bien… ou du mal">
        <Field label="As-tu déjà eu une mauvaise réaction à un produit ou à un actif ?" required>
          <Pills
            options={HAD_REACTION_OPTIONS}
            value={answers.hadReaction}
            onChange={(v) => setField("hadReaction", v)}
          />
        </Field>
        {answers.hadReaction === "oui" && (
          <>
            <Field label="Quel produit ou actif a provoqué la réaction ?">
              <input
                type="text"
                value={answers.reactionProduct}
                onChange={(e) => setField("reactionProduct", e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="Décris précisément ce qui s'est passé.">
              <textarea
                value={answers.reactionDescription}
                onChange={(e) => setField("reactionDescription", e.target.value)}
                placeholder="Brûlures, rougeurs, boutons, démangeaisons, gonflement, desquamation importante ou aggravation rapide."
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </>
        )}
        <Field label="Quels produits ta peau a-t-elle particulièrement bien tolérés ?">
          <textarea
            value={answers.toleratedProducts}
            onChange={(e) => setField("toleratedProducts", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Quels produits as-tu détestés ou que tu ne souhaites plus utiliser ?">
          <textarea
            value={answers.hatedProducts}
            onChange={(e) => setField("hatedProducts", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[5]}`}
      />
    </QuestionnaireShell>
  );
}
