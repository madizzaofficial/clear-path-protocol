import { Outlet, createFileRoute } from "@tanstack/react-router";
import { QuestionnaireProvider } from "@/hooks/use-questionnaire";

export const Route = createFileRoute("/questionnaire")({
  component: QuestionnaireLayout,
});

function QuestionnaireLayout() {
  return (
    <QuestionnaireProvider>
      <Outlet />
    </QuestionnaireProvider>
  );
}
