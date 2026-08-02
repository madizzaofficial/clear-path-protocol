import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useRestrictedRedirect } from "@/hooks/use-restricted-redirect";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { IngredientAnalyzerPage } from "@/components/IngredientAnalyzer";

export const Route = createFileRoute("/ingredient-analyzer")({
  component: IngredientAnalyzerRoute,
});

function IngredientAnalyzerRoute() {
  const { user, loading } = useAuth();
  const restricted = useRestrictedRedirect();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user || restricted) return null;

  return (
    <AppShell>
      <IngredientAnalyzerPage />
    </AppShell>
  );
}
