import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { IngredientAnalyzerPage } from "@/components/IngredientAnalyzer";

export const Route = createFileRoute("/admin_/ingredient-analyzer")({
  component: IngredientAnalyzerRoute,
});

function IngredientAnalyzerRoute() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/admin" });
  }, [user, isAdmin, loading, navigate]);

  return (
    <AdminShell>
      <IngredientAnalyzerPage />
    </AdminShell>
  );
}
