import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { SortableStep, StepDialog } from "@/components/RoutineStepEditor";
import type { RoutineStep, ExtraBlock } from "@/components/RoutineStepEditor";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { CatalogProduct } from "./admin_.products";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
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
  ArrowLeft,
  Plus,
  Loader2,
  Save,
  Sun,
  Moon,
  Zap,
  Pencil,
  Trash2,
} from "lucide-react";
import { CATEGORIES } from "@/lib/skincare-categories";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoutineTemplate = {
  id: string;
  name: string;
  description?: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  extras: ExtraBlock[];
  createdAt: number;
  updatedAt: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/templates/$templateId")({
  head: () => ({ meta: [{ title: "Éditeur de modèle — Protocole Clear" }] }),
  component: TemplateEditorPage,
});

// ─── Guard ────────────────────────────────────────────────────────────────────

function TemplateEditorPage() {
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

  return <TemplateEditorContent />;
}

// ─── Editor ──────────────────────────────────────────────────────────────────

function TemplateEditorContent() {
  const { templateId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = templateId === "new";

  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"am" | "pm">("am");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [savingToCatalog, setSavingToCatalog] = useState(false);

  const [editingStep, setEditingStep] = useState<RoutineStep | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const [editingExtrasBlockId, setEditingExtrasBlockId] = useState<string | null>(null);
  const [deletingStepInfo, setDeletingStepInfo] = useState<{ blockId: string; stepId: string } | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    async function load() {
      const [catalogSnap] = await Promise.all([getDocs(collection(db, "admin_products"))]);
      setCatalogProducts(catalogSnap.docs.map((d) => d.data() as CatalogProduct));

      if (!isNew) {
        setLoading(true);
        try {
          const snap = await getDoc(doc(db, "routine_templates", templateId));
          if (snap.exists()) {
            const data = snap.data() as RoutineTemplate;
            const t = { ...data, extras: data.extras ?? [] };
            setTemplate(t);
            setName(t.name);
            setDescription(t.description ?? "");
          } else {
            navigate({ to: "/admin/templates" });
          }
        } finally {
          setLoading(false);
        }
      } else {
        setTemplate({ id: "", name: "", am: [], pm: [], extras: [], createdAt: 0, updatedAt: 0 });
      }
    }
    load();
  }, [templateId, isNew, navigate]);

  async function save() {
    if (!template || !name.trim()) return;
    setSaving(true);
    try {
      const id = isNew ? crypto.randomUUID() : template.id || crypto.randomUUID();
      const updated: RoutineTemplate = {
        ...template,
        id,
        name: name.trim(),
        description: description.trim() || undefined,
        updatedAt: Date.now(),
        createdAt: template.createdAt || Date.now(),
      };
      await setDoc(doc(db, "routine_templates", id), JSON.parse(JSON.stringify(updated)));
      setTemplate(updated);
      if (isNew) navigate({ to: "/admin/templates/$templateId", params: { templateId: id } });
    } finally {
      setSaving(false);
    }
  }

  function handleStepDragEnd(tab: "am" | "pm", event: DragEndEvent) {
    if (!template) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const steps = tab === "am" ? template.am : template.pm;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, from, to).map((s, i) => ({ ...s, order: i }));
    setTemplate({ ...template, [tab]: reordered });
  }

  function handleSaveStep(data: {
    category: string;
    product: string;
    description?: string;
    instructions: string;
    imageUrl?: string;
    purchaseUrl?: string;
  }) {
    if (!template) return;
    let updated: RoutineTemplate;
    if (editingExtrasBlockId !== null) {
      const block = template.extras.find((b) => b.id === editingExtrasBlockId);
      if (!block) return;
      const newSteps = isNewStep
        ? [...block.steps, { id: `s-${Date.now()}`, order: block.steps.length, ...data }]
        : block.steps.map((s) => (s.id === editingStep?.id ? { ...s, ...data } : s));
      updated = { ...template, extras: template.extras.map((b) => (b.id === editingExtrasBlockId ? { ...b, steps: newSteps } : b)) };
    } else {
      const steps = activeTab === "am" ? template.am : template.pm;
      if (isNewStep) {
        updated = { ...template, [activeTab]: [...steps, { id: `s-${Date.now()}`, order: steps.length, ...data }] };
      } else if (editingStep) {
        updated = { ...template, [activeTab]: steps.map((s) => (s.id === editingStep.id ? { ...s, ...data } : s)) };
      } else return;
    }
    setTemplate(updated);
    setEditingStep(null);
    setEditingExtrasBlockId(null);
  }

  async function handleSaveToCatalog(data: {
    category: string;
    product: string;
    description?: string;
    instructions: string;
    imageUrl?: string;
    purchaseUrl?: string;
  }) {
    setSavingToCatalog(true);
    try {
      const existing = catalogProducts.find(
        (p) => p.name.toLowerCase() === data.product.trim().toLowerCase() && p.category === data.category,
      );
      const id = existing?.id ?? crypto.randomUUID();
      const entry: CatalogProduct = {
        id,
        name: data.product.trim(),
        category: data.category,
        description: data.description,
        instructions: data.instructions,
        imageUrl: data.imageUrl,
        purchaseUrl: data.purchaseUrl,
        verified: existing?.verified ?? true,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "admin_products", id), entry);
      setCatalogProducts((prev) => (existing ? prev.map((p) => (p.id === id ? entry : p)) : [...prev, entry]));
    } finally {
      setSavingToCatalog(false);
    }
  }

  function handleDeleteStep() {
    if (!template || !deletingStepId) return;
    const steps = (activeTab === "am" ? template.am : template.pm)
      .filter((s) => s.id !== deletingStepId)
      .map((s, i) => ({ ...s, order: i }));
    setTemplate({ ...template, [activeTab]: steps });
    setDeletingStepId(null);
  }

  function handleDeleteExtrasStep() {
    if (!template || !deletingStepInfo) return;
    const { blockId, stepId } = deletingStepInfo;
    const block = template.extras.find((b) => b.id === blockId);
    if (!block) { setDeletingStepInfo(null); return; }
    const steps = block.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i }));
    setTemplate({ ...template, extras: template.extras.map((b) => (b.id === blockId ? { ...b, steps } : b)) });
    setDeletingStepInfo(null);
  }

  function handleDeleteBlock() {
    if (!template || !deletingBlockId) return;
    setTemplate({ ...template, extras: template.extras.filter((b) => b.id !== deletingBlockId) });
    setDeletingBlockId(null);
  }

  function addExtrasBlock() {
    if (!template) return;
    const newBlock: ExtraBlock = { id: `b-${Date.now()}`, name: "En cas de…", steps: [] };
    setTemplate({ ...template, extras: [...template.extras, newBlock] });
    setEditingBlockId(newBlock.id);
    setEditingBlockName(newBlock.name);
  }

  function saveBlockName(blockId: string) {
    if (!template || !editingBlockName.trim()) { setEditingBlockId(null); return; }
    setTemplate({ ...template, extras: template.extras.map((b) => (b.id === blockId ? { ...b, name: editingBlockName.trim() } : b)) });
    setEditingBlockId(null);
  }

  const currentSteps = template ? (activeTab === "am" ? template.am : template.pm) : [];

  if (loading) {
    return (
      <AdminShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        {/* Back link */}
        <div className="mb-6">
          <Link
            to="/admin/templates"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux modèles
          </Link>
        </div>

        {/* Name + description */}
        <div className="mb-8 space-y-3 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nom du modèle *</label>
            <input

              autoComplete="off"              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Peau grasse légère, Peau sensible sévère…"
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Description <span className="font-normal text-muted-foreground">(optionnel)</span>
            </label>
            <textarea

              autoComplete="off"              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Indications, profil type…"
              rows={2}
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* AM / PM tabs */}
        <div className="mb-4 flex gap-2 rounded-2xl bg-muted p-1.5">
          {(["am", "pm"] as const).map((tab) => {
            const count = template ? (tab === "am" ? template.am.length : template.pm.length) : 0;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  isActive ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "am" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {tab === "am" ? "Matin" : "Soir"}
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Steps list */}
        <div className="mb-4 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          {currentSteps.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Aucune étape — ajoutez la première ci-dessous.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleStepDragEnd(activeTab, e)}>
              <SortableContext items={currentSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border/40">
                  {currentSteps.map((step, idx) => (
                    <SortableStep key={step.id} step={step} idx={idx}
                      onEdit={() => { setEditingStep(step); setIsNewStep(false); }}
                      onDelete={() => setDeletingStepId(step.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <div className={`p-4 ${currentSteps.length > 0 ? "border-t border-border/40" : ""}`}>
            <button
              onClick={() => { setEditingStep({ id: "", order: currentSteps.length, category: CATEGORIES[0], product: "", instructions: "" }); setIsNewStep(true); }}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Ajouter une étape
            </button>
          </div>
        </div>

        {/* ── En cas de (named blocks) ─────────────────────────── */}
        {template && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold">En cas de…</span>
              <span className="text-xs text-muted-foreground">Conseils situationnels — optionnel</span>
            </div>

            {template.extras.map((block) => (
              <div key={block.id} className="overflow-hidden rounded-3xl border border-yellow-200/60 bg-card shadow-soft dark:border-yellow-900/30">
                <div className="flex items-center gap-2 border-b border-yellow-100/60 bg-yellow-50/40 px-5 py-3 dark:border-yellow-900/20 dark:bg-yellow-950/10">
                  {editingBlockId === block.id ? (
                    <input

                      autoComplete="off"                      autoFocus
                      value={editingBlockName}
                      onChange={(e) => setEditingBlockName(e.target.value)}
                      onBlur={() => saveBlockName(block.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingBlockId(null); }}
                      className="flex-1 rounded-xl border border-yellow-300/60 bg-white/60 px-3 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-yellow-400/30 dark:bg-yellow-900/20"
                    />
                  ) : (
                    <button onClick={() => { setEditingBlockId(block.id); setEditingBlockName(block.name); }} className="flex flex-1 items-center gap-2 text-left">
                      <span className="text-sm font-semibold">{block.name}</span>
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-60" />
                    </button>
                  )}
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">{block.steps.length}</span>
                  <button onClick={() => setDeletingBlockId(block.id)} className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {block.steps.length > 0 && (
                  <ul className="divide-y divide-border/40">
                    {block.steps.map((step, idx) => (
                      <li key={step.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{step.product}</p>
                          <p className="text-xs text-muted-foreground">{step.category}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingStep(step); setIsNewStep(false); setEditingExtrasBlockId(block.id); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeletingStepInfo({ blockId: block.id, stepId: step.id })} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className={`p-4 ${block.steps.length > 0 ? "border-t border-border/40" : ""}`}>
                  <button
                    onClick={() => { setEditingStep({ id: "", order: block.steps.length, category: CATEGORIES[0], product: "", instructions: "" }); setIsNewStep(true); setEditingExtrasBlockId(block.id); }}
                    className="flex items-center gap-2 rounded-2xl border border-dashed border-yellow-300/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-yellow-400 hover:bg-yellow-50/60 hover:text-foreground dark:border-yellow-800/40 dark:hover:bg-yellow-950/20"
                  >
                    <Plus className="h-4 w-4" /> Ajouter une étape
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addExtrasBlock}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-yellow-300/60 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-yellow-400 hover:bg-yellow-50/40 hover:text-foreground dark:border-yellow-800/40 dark:hover:bg-yellow-950/20"
            >
              <Plus className="h-4 w-4" /> Ajouter un bloc « En cas de »
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isNew ? "Créer le modèle" : "Sauvegarder"}
          </button>
        </div>
      </main>

      {/* Step dialog */}
      <StepDialog
        step={editingStep}
        isNew={isNewStep}
        onClose={() => { setEditingStep(null); setEditingExtrasBlockId(null); }}
        onSave={handleSaveStep}
        saving={false}
        catalogProducts={catalogProducts}
        onSaveToCatalog={handleSaveToCatalog}
        savingToCatalog={savingToCatalog}
      />

      {/* Delete AM/PM step */}
      <AlertDialog open={!!deletingStepId} onOpenChange={(o) => !o && setDeletingStepId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette étape ?</AlertDialogTitle>
            <AlertDialogDescription>Cette étape sera supprimée du modèle.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStep} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete extras block step */}
      <AlertDialog open={!!deletingStepInfo} onOpenChange={(o) => !o && setDeletingStepInfo(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette étape ?</AlertDialogTitle>
            <AlertDialogDescription>Cette étape sera supprimée du bloc.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExtrasStep} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete extras block */}
      <AlertDialog open={!!deletingBlockId} onOpenChange={(o) => !o && setDeletingBlockId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer ce bloc ?</AlertDialogTitle>
            <AlertDialogDescription>Le bloc et toutes ses étapes seront définitivement supprimés.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlock} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
