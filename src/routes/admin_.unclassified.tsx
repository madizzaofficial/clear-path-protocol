import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, HelpCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UnclassifiedEntry = {
  normalized: string;
  raw: string;
  count: number;
  lastSeen: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

// Route ID is registered in routeTree.gen.ts after first `npm run dev`
export const Route = (createFileRoute as any)("/admin_/unclassified")({
  head: () => ({
    meta: [{ title: "Ingrédients non classifiés — Protocole Clear" }],
  }),
  component: UnclassifiedPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function UnclassifiedPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user || !isAdmin) return null;
  return <UnclassifiedContent />;
}

function UnclassifiedContent() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<UnclassifiedEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    getDocs(collection(db, "unclassified_ingredients"))
      .then((snap) => {
        const data = snap.docs.map((d) => d.data() as UnclassifiedEntry);
        setEntries(data.sort((a, b) => b.count - a.count));
      })
      .finally(() => setLoadingData(false));
  }, []);

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => (navigate as any)({ to: "/admin/products" })}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au catalogue
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Ingrédients non classifiés
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ingrédients vus lors des analyses sans rôle identifié — triés par fréquence.
                À enrichir dans <code className="rounded bg-muted px-1 py-0.5 text-xs">COMMON_INGREDIENTS</code> ou via les patterns <code className="rounded bg-muted px-1 py-0.5 text-xs">inferRoleFromName</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <HelpCircle className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Aucun ingrédient non classifié pour l'instant.</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
            <div className="border-b border-border/60 px-6 py-4">
              <p className="text-sm text-muted-foreground">{entries.length} ingrédient{entries.length > 1 ? "s" : ""}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nom brut</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Normalisé</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vus</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dernière fois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {entries.map((e) => (
                  <tr key={e.normalized} className="hover:bg-muted/20">
                    <td className="px-6 py-3 font-medium text-foreground">{e.raw}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{e.normalized}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{e.count}</span>
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-muted-foreground">
                      {new Date(e.lastSeen).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
