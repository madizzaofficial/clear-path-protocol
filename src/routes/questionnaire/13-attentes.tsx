import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuestionnaire } from "@/hooks/use-questionnaire";
import {
  QuestionnaireShell,
  Section,
  Field,
  MultiPills,
} from "@/components/questionnaire/QuestionnaireUI";
import { FEAR_OPTIONS, SECTION_SLUGS } from "@/lib/questionnaire-constants";
import { CenterSpinner, NavButtons } from "@/components/questionnaire/NavButtons";

export const Route = createFileRoute("/questionnaire/13-attentes")({
  head: () => ({ meta: [{ title: "Section 13 — Protocole Clear" }] }),
  component: Section13,
});

function Section13() {
  const { user, loading } = useAuth();
  const { answers, setField, markSection, loading: qLoading } = useQuestionnaire();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || qLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [loading, qLoading, user, navigate]);

  if (loading || qLoading) return <CenterSpinner />;

  // Optional section — no required field, but at least one text answer is preferred
  function handleNext() {
    markSection(13);
    navigate({ to: `/questionnaire/${SECTION_SLUGS[13]}` });
  }

  return (
    <QuestionnaireShell step={13} totalSteps={14} title="Tes attentes">
      <Section title="Ce qui ferait une vraie différence pour toi">
        <Field label="Quelle est ta plus grande peur concernant une nouvelle routine ?">
          <MultiPills
            options={FEAR_OPTIONS}
            values={answers.fears}
            onChange={(v) => setField("fears", v)}
          />
        </Field>
        <Field label="Si on se reparle dans trois mois, qu'est-ce qui te ferait dire que cette routine a été une réussite ?">
          <textarea
            value={answers.successDefinition}
            onChange={(e) => setField("successDefinition", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Qu'est-ce qui t'a poussé à acheter cette routine aujourd'hui ?">
          <textarea
            value={answers.purchaseReason}
            onChange={(e) => setField("purchaseReason", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Y a-t-il autre chose que tu aimerais me préciser avant que je commence ton analyse ?">
          <textarea
            value={answers.additionalInfo}
            onChange={(e) => setField("additionalInfo", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Section>
      <NavButtons
        onNext={handleNext}
        canAdvance={true}
        prev={`/questionnaire/${SECTION_SLUGS[11]}`}
      />
    </QuestionnaireShell>
  );
}
