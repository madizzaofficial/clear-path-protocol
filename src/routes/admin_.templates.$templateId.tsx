import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { SortableStep, StepDialog } from "@/components/RoutineStepEditor";
import type { RoutineStep } from "@/components/RoutineStepEditor";
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
  Check,
} from "lucide-react";
import { CATEGORIES } from "@/lib/skincare-categories";

// ─── Types ────────────────────────────────────────────────────────────────────

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
            const t = snap.data() as RoutineTemplate;
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
        setTemplate({ id: "", name: "", am: [], pm: [], createdAt: 0, updatedAt: 0 });
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
    const steps = activeTab === "am" ? template.am : template.pm;
    let updated: RoutineTemplate;
    if (isNewStep) {
      const newStep: RoutineStep = { id: `s-${Date.now()}`, order: steps.length, ...data };
      updated = { ...template, [activeTab]: [...steps, newStep] };
    } else if (editingStep) {
      updated = {
        ...template,
        [activeTab]: steps.map((s) => (s.id === editingStep.id ? { ...s, ...data } : s)),
      };
    } else return;
    setTemplate(updated);
    setEditingStep(null);
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
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:pt-12">
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
              type="text"
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
              value={description}
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
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Steps list */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          {currentSteps.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Aucune étape — ajoutez la première ci-dessous.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => handleStepDragEnd(activeTab, e)}
            >
              <SortableContext items={currentSteps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border/40">
                  {currentSteps.map((step, idx) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      idx={idx}
                      onEdit={() => {
                        setEditingStep(step);
                        setIsNewStep(false);
                      }}
                      onDelete={() => setDeletingStepId(step.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <div className={`p-4 ${currentSteps.length > 0 ? "border-t border-border/40" : ""}`}>
            <button
              onClick={() => {
                setEditingStep({ id: "", order: currentSteps.length, category: CATEGORIES[0], product: "", instructions: "" });
                setIsNewStep(true);
              }}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Ajouter une étape
            </button>
          </div>
        </div>

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
        onClose={() => setEditingStep(null)}
        onSave={handleSaveStep}
        saving={false}
        catalogProducts={catalogProducts}
        onSaveToCatalog={handleSaveToCatalog}
        savingToCatalog={savingToCatalog}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingStepId} onOpenChange={(o) => !o && setDeletingStepId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette étape ?</AlertDialogTitle>
            <AlertDialogDescription>Cette étape sera supprimée du modèle.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStep}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
