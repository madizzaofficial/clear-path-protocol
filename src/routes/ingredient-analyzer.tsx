import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { IngredientAnalyzerPage } from "@/components/IngredientAnalyzer";

export const Route = createFileRoute("/ingredient-analyzer")({
  component: IngredientAnalyzerRoute,
});

function IngredientAnalyzerRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <IngredientAnalyzerPage />
    </AppShell>
  );
}
