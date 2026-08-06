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
  DERMATOLOGIST_OPTIONS,
  PRESCRIBED_TREATMENT_OPTIONS,
  SECTION_SLUGS,
} from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire/05-historique")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  head: () => ({ meta: [{ title: "Section 5 — Protocole Clear" }] }),
  component: Section5,
});

function Section5() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  const canAdvance = !!answers.dermatologistVisit && !!answers.currentlyOnTreatment;

  function handleNext() {
    if (!canAdvance) return;
    markSection(5);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[5]}` });
  }

  const showIsotretinoin = answers.prescribedTreatments.includes("isotretinoine");

  return (
    <QuestionnaireShell step={5} totalSteps={14} title="Historique dermatologique">
      <Section title="Tes expériences passées avec les traitements">
        <Field label="As-tu déjà consulté un dermatologue pour ce problème ?" required>
          <Pills
            options={DERMATOLOGIST_OPTIONS}
            value={answers.dermatologistVisit}
            onChange={(v) => setField("dermatologistVisit", v)}
          />
        </Field>
        {answers.dermatologistVisit === "oui" && (
          <Field label="Quels traitements ou produits t'ont déjà été prescrits ou conseillés ?">
            <MultiPills
              options={PRESCRIBED_TREATMENT_OPTIONS}
              values={answers.prescribedTreatments}
              onChange={(v) => setField("prescribedTreatments", v)}
            />
          </Field>
        )}
        <Field label="Utilises-tu actuellement un traitement prescrit pour ta peau ?" required>
          <Pills
            options={DERMATOLOGIST_OPTIONS}
            value={answers.currentlyOnTreatment}
            onChange={(v) => setField("currentlyOnTreatment", v)}
          />
        </Field>
        {answers.currentlyOnTreatment === "oui" && (
          <Field label="Quel traitement utilises-tu actuellement, depuis quand et à quelle fréquence ?">
            <textarea
              value={answers.currentTreatmentDetails}
              onChange={(e) => setField("currentTreatmentDetails", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>
        )}
        {showIsotretinoin && (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Suivi Roaccutane
            </p>
            <div className="flex flex-col gap-3">
              <Field label="Combien de cures d'isotrétinoïne as-tu suivies ?">
                <input
                  type="number"
                  min={0}
                  value={answers.isotretinoinCures ?? ""}
                  onChange={(e) =>
                    setField("isotretinoinCures", e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-32 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>
              <Field label="Quand as-tu terminé ta dernière cure ?">
                <input
                  type="text"
                  value={answers.isotretinoinLastEnd}
                  onChange={(e) => setField("isotretinoinLastEnd", e.target.value)}
                  placeholder="Ex : mars 2023"
                  className="w-64 rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>
              <Field label="Ton acné est-elle revenue après le traitement ?">
                <input
                  type="text"
                  value={answers.acneReturnedAfter}
                  onChange={(e) => setField("acneReturnedAfter", e.target.value)}
                  placeholder="Oui / Non / Partiellement / Encore sous traitement"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>
            </div>
          </div>
        )}
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={canAdvance}
        prev={`/questionnaire/${SECTION_SLUGS[3]}`}
      />
    </QuestionnaireShell>
  );
}
