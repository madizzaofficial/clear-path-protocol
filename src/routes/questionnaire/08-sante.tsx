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

export const Route = createFileRoute("/questionnaire/08-sante")({
  head: () => ({ meta: [{ title: "Section 8 — Protocole Clear" }] }),
  component: Section8,
});

const YES_NO_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "je_sais_pas", label: "Je ne sais pas" },
];

const YES_NO_PREF_OPTIONS = [
  ...YES_NO_OPTIONS,
  { value: "prefere_pas", label: "Je préfère ne pas répondre" },
];

const PREGNANCY_OPTIONS = [
  { value: "enceinte", label: "Enceinte" },
  { value: "allaite", label: "J'allaite" },
  { value: "aucun", label: "Ni l'un ni l'autre" },
  { value: "prefere_pas", label: "Je préfère ne pas répondre" },
];

const CYCLE_OPTIONS = [...YES_NO_OPTIONS, { value: "non_applicable", label: "Non applicable" }];

function Section8() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.medication && !!answers.sopk && !!answers.menstrualCycle;

  function handleNext() {
    if (!canAdvance) return;
    markSection(8);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[8]}` });
  }

  const isFemale = answers.gender === "femme";

  return (
    <QuestionnaireShell
      step={8}
      totalSteps={14}
      title="Informations de santé"
      intro="Ces informations permettent uniquement d'éviter des recommandations inadaptées. Elles ne remplacent pas un avis médical."
    >
      <Section title="Santé générale">
        <Field label="As-tu des allergies connues, notamment à des ingrédients cosmétiques ou à des médicaments ?">
          <input
            type="text"
            value={answers.allergies}
            onChange={(e) => setField("allergies", e.target.value)}
            placeholder="Réponse possible : Aucune à ma connaissance"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field
          label="Prends-tu actuellement un traitement médical susceptible d'avoir un impact sur ta peau ?"
          required
        >
          <Pills
            options={YES_NO_OPTIONS}
            value={answers.medication}
            onChange={(v) => setField("medication", v)}
          />
        </Field>
        {answers.medication === "oui" && (
          <Field label="Lequel ?">
            <input
              type="text"
              value={answers.medicationDetails}
              onChange={(e) => setField("medicationDetails", e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
        )}
        {isFemale && (
          <Field label="Es-tu actuellement enceinte ou allaites-tu ?" required>
            <Pills
              options={PREGNANCY_OPTIONS}
              value={answers.pregnancy}
              onChange={(v) => setField("pregnancy", v)}
            />
          </Field>
        )}
        <Field
          label="As-tu reçu un diagnostic de syndrome des ovaires polykystiques (SOPK) ?"
          required
        >
          <Pills
            options={YES_NO_PREF_OPTIONS}
            value={answers.sopk}
            onChange={(v) => setField("sopk", v)}
          />
        </Field>
        <Field
          label="Constates-tu une aggravation de ton acné à certaines périodes de ton cycle ?"
          required
        >
          <Pills
            options={CYCLE_OPTIONS}
            value={answers.menstrualCycle}
            onChange={(v) => setField("menstrualCycle", v)}
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[6]}`}
      />
    </QuestionnaireShell>
  );
}
