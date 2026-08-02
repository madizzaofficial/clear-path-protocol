import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Protocole Clear" }] }),
  component: HomeRedirect,
});

function HomeRedirect() {
  const { user, loading, accountType } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // routine_only élèves → Routine ; full/admin → Suivi.
    navigate({ to: accountType === "routine_only" ? "/products" : "/suivi" });
  }, [loading, user, accountType, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
