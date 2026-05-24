import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, HelpCircle, Loader2, Tag } from "lucide-react";
import { INGREDIENT_ROLES } from "@/lib/cosmetic-ingredients";

// ─── Types ────────────────────────────────────────────────────────────────────

type UnclassifiedEntry = {
  normalized: string;
  raw: string;
  count: number;
  lastSeen: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<UnclassifiedEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  // classifying: normalized key → selected role
  const [classifying, setClassifying] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, "unclassified_ingredients"))
      .then((snap) => {
        const data = snap.docs.map((d) => d.data() as UnclassifiedEntry);
        setEntries(data.sort((a, b) => b.count - a.count));
      })
      .finally(() => setLoadingData(false));
  }, []);

  function startClassify(normalized: string) {
    setClassifying((prev) => ({ ...prev, [normalized]: INGREDIENT_ROLES[0] }));
  }

  function cancelClassify(normalized: string) {
    setClassifying((prev) => {
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  }

  async function saveClassification(entry: UnclassifiedEntry) {
    const role = classifying[entry.normalized];
    if (!role) return;
    setSaving(entry.normalized);
    try {
      await setDoc(doc(db, "custom_ingredients", entry.normalized), {
        normalized: entry.normalized,
        raw: entry.raw,
        role,
        addedAt: Date.now(),
        addedBy: user?.uid ?? "",
      });
      await deleteDoc(doc(db, "unclassified_ingredients", entry.normalized));
      setEntries((prev) => prev.filter((e) => e.normalized !== entry.normalized));
      setClassifying((prev) => {
        const next = { ...prev };
        delete next[entry.normalized];
        return next;
      });
    } finally {
      setSaving(null);
    }
  }

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
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Ingrédients non classifiés
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingrédients vus lors des analyses sans rôle identifié — triés par fréquence.
              Assigne un rôle pour les classer directement depuis l'UI, sans redéploiement.
            </p>
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
              <p className="text-sm text-muted-foreground">
                {entries.length} ingrédient{entries.length > 1 ? "s" : ""}
              </p>
            </div>
            <ul className="divide-y divide-border/40">
              {entries.map((e) => {
                const isOpen = e.normalized in classifying;
                const isSaving = saving === e.normalized;
                return (
                  <li key={e.normalized}>
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{e.raw}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{e.normalized}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                          ×{e.count}
                        </span>
                        <span className="hidden text-xs text-muted-foreground sm:block">
                          {new Date(e.lastSeen).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                        {!isOpen && (
                          <button
                            onClick={() => startClassify(e.normalized)}
                            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Tag className="h-3 w-3" />
                            Classer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline classify form */}
                    {isOpen && (
                      <div className="flex items-center gap-2 border-t border-border/40 bg-muted/20 px-5 py-3">
                        <select
                          value={classifying[e.normalized]}
                          onChange={(ev) =>
                            setClassifying((prev) => ({ ...prev, [e.normalized]: ev.target.value }))
                          }
                          className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                        >
                          {INGREDIENT_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveClassification(e)}
                          disabled={isSaving}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Valider
                        </button>
                        <button
                          onClick={() => cancelClassify(e.normalized)}
                          className="flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
