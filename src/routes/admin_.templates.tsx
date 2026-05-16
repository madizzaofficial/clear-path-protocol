import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  LayoutTemplate,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Check,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  instructions: string;
  imageUrl?: string;
};

type RoutineTemplate = {
  id: string;
  name: string;
  description?: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  createdAt: number;
  updatedAt: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/templates")({
  head: () => ({
    meta: [{ title: "Modèles de routines — Protocole Clear" }],
  }),
  component: TemplatesPage,
});

// ─── Guard wrapper ────────────────────────────────────────────────────────────

function TemplatesPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/admin" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return <TemplatesContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function TemplatesContent() {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<RoutineTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "routine_templates"));
        const list = snap.docs.map((d) => d.data() as RoutineTemplate);
        list.sort((a, b) => b.createdAt - a.createdAt);
        setTemplates(list);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleDelete() {
    if (!deletingId) return;
    await deleteDoc(doc(db, "routine_templates", deletingId));
    setTemplates((prev) => prev.filter((t) => t.id !== deletingId));
    setDeletingId(null);
  }

  async function handleSaveEdit() {
    if (!editingTemplate || !editName.trim()) return;
    setSaving(true);
    try {
      const updated: RoutineTemplate = {
        ...editingTemplate,
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "routine_templates", updated.id), updated);
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTemplate(null);
    } finally {
      setSaving(false);
    }
  }

  const deletingTemplate = templates.find((t) => t.id === deletingId);

  return (
    <AdminShell>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8 md:pt-12">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-6">
            <Link
              to="/admin/routines"
              search={{ uid: "" }}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Retour aux routines
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Modèles de routines
            </h1>
            <p className="mt-2 text-muted-foreground">
              Gérez les modèles réutilisables pour créer rapidement des routines élèves.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-border bg-card">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
                <LayoutTemplate className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Aucun modèle</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Créez des modèles depuis l'éditeur de routines.
              </p>
              <Link
                to="/admin/routines"
                search={{ uid: "" }}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/20"
              >
                Aller à l'éditeur
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const expanded = expandedId === t.id;
              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
                      <LayoutTemplate className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{t.name}</p>
                      {t.description && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                          <Sun className="h-3 w-3" /> {t.am.length} étape{t.am.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                          <Moon className="h-3 w-3" /> {t.pm.length} étape{t.pm.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => {
                          setEditName(t.name);
                          setEditDesc(t.description ?? "");
                          setEditingTemplate(t);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Renommer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(t.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExpandedId(expanded ? null : t.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted"
                        title={expanded ? "Réduire" : "Voir les étapes"}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded steps */}
                  {expanded && (
                    <div className="border-t border-border/60 px-5 pb-5 pt-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        {(["am", "pm"] as const).map((slot) => {
                          const steps = t[slot];
                          const Icon = slot === "am" ? Sun : Moon;
                          const label = slot === "am" ? "Matin" : "Soir";
                          return (
                            <div key={slot}>
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <Icon className="h-3.5 w-3.5" /> {label}
                              </p>
                              {steps.length === 0 ? (
                                <p className="text-xs italic text-muted-foreground">Aucune étape.</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {steps.map((s, i) => (
                                    <li
                                      key={s.id}
                                      className="flex items-start gap-2.5 rounded-xl bg-muted/40 px-3 py-2"
                                    >
                                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                                        {i + 1}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold leading-tight">{s.product}</p>
                                        <p className="text-[10px] text-muted-foreground">{s.category}</p>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le modèle <strong>«&nbsp;{deletingTemplate?.name}&nbsp;»</strong> sera définitivement supprimé. Les routines
              élèves déjà créées à partir de ce modèle ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(o) => !o && setEditingTemplate(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le modèle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom *</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optionnel)</span>
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setEditingTemplate(null)}
              className="rounded-2xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editName.trim()}
              className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
