import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { QuestionnaireProvider } from "@/hooks/use-questionnaire";
import { ONBOARDING_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/questionnaire")({
  // ponytail: onboarding désactivé — ONBOARDING_ENABLED=true pour le rouvrir.
  beforeLoad: () => {
    if (!ONBOARDING_ENABLED) throw redirect({ to: "/products" });
  },
  component: QuestionnaireLayout,
});

function QuestionnaireLayout() {
  return (
    <QuestionnaireProvider>
      <Outlet />
    </QuestionnaireProvider>
  );
}
