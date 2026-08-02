// Redirects accountType='routine_only' users away from full-only pages
// (Suivi, Protocole, FAQ, Profile, Analyseur INCI, …) toward /products.
//
// Call at the top of the component:
//   const restricted = useRestrictedRedirect();
//   if (restricted) return null;
//
// The redirect runs once accountType is known and the user is on a blocked route.

import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export function useRestrictedRedirect(): boolean {
  const { user, accountType, loading } = useAuth();
  const navigate = useNavigate();

  const isRestricted = !!user && accountType === "routine_only";

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (accountType === "routine_only") {
      navigate({ to: "/products" });
    }
  }, [loading, user, accountType, navigate]);

  return isRestricted;
}
