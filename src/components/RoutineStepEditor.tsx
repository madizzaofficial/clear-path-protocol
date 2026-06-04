/**
 * Shared DnD step-editing components used by both the student routine editor
 * (admin_.routines.tsx) and the template editor (admin_.templates.$templateId.tsx).
 */
import { useEffect, useMemo, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  GripVertical,
  Loader2,
  Package,
  Pencil,
  Trash2,
  Upload,
  X,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/SearchInput";
import { uploadProductImageFn } from "@/lib/upload-image";
import { CATEGORIES } from "@/lib/skincare-categories";
import type { CatalogProduct } from "@/routes/admin_.products";
import type { InciAnalysis } from "@/lib/inci-analysis";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  brand?: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
  startWeek?: number;
  introNote?: string;
  whyThisProduct?: string;
  inciAnalysis?: InciAnalysis;
};

export type ExtraBlock = {
  id: string;
  name: string;
  steps: RoutineStep[];
};

export type StepSaveData = {
  category: string;
  product: string;
  brand?: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
  startWeek?: number;
  introNote?: string;
  whyThisProduct?: string;
  inciAnalysis?: InciAnalysis;
};

// ─── SortableStep ─────────────────────────────────────────────────────────────

export function SortableStep({
  step,
  idx,
  onEdit,
  onDelete,
}: {
  step: RoutineStep;
  idx: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-3 px-5 py-4 md:px-6">
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing"
        title="Réorganiser"
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
        {idx + 1}
      </span>
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {step.category}
        </span>
        <p className="mt-1 text-sm font-semibold">
          {step.product || <span className="italic text-muted-foreground">—</span>}
        </p>
        {step.brand && (
          <p className="text-xs text-muted-foreground">{step.brand}</p>
        )}
        {step.instructions && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.instructions}</p>
        )}
      </div>
      {step.imageUrl && (
        <img
          src={step.imageUrl}
          alt={step.product}
          className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
        />
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Modifier"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Supprimer"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── StepDialog ───────────────────────────────────────────────────────────────

export function StepDialog({
  step,
  isNew,
  onClose,
  onSave,
  saving,
  catalogProducts,
  onSaveToCatalog,
  savingToCatalog,
}: {
  step: RoutineStep | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: StepSaveData) => void;
  saving: boolean;
  catalogProducts: CatalogProduct[];
  onSaveToCatalog: (data: StepSaveData) => Promise<void>;
  savingToCatalog: boolean;
}) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [product, setProduct] = useState("");
  const [brand, setBrand] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [startWeek, setStartWeek] = useState<number | "">("");
  const [introNote, setIntroNote] = useState("");
  const [whyThisProduct, setWhyThisProduct] = useState("");
  const [stepInciAnalysis, setStepInciAnalysis] = useState<InciAnalysis | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  const catalogResults = useMemo(() => {
    if (!catalogSearch.trim()) return catalogProducts.slice(0, 8);
    const q = catalogSearch.toLowerCase();
    return catalogProducts
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 20);
  }, [catalogProducts, catalogSearch]);

  useEffect(() => {
    if (step) {
      setCategory(step.category || CATEGORIES[0]);
      setProduct(step.product);
      setBrand(step.brand ?? "");
      setInstructions(step.instructions);
      setImageUrl(step.imageUrl ?? "");
      setPurchaseUrl(step.purchaseUrl ?? "");
      setStartWeek(step.startWeek ?? "");
      setIntroNote(step.introNote ?? "");
      setWhyThisProduct(step.whyThisProduct ?? "");
      setStepInciAnalysis(step.inciAnalysis);
      setUploadError(null);
      setUploading(false);
      setShowCatalogPicker(false);
      setCatalogSearch("");
    }
  }, [step]);

  function fillFromCatalog(p: CatalogProduct) {
    setCategory(p.category);
    setProduct(p.name);
    setBrand(p.brand ?? "");
    setInstructions(p.instructions);
    setImageUrl(p.imageUrl ?? "");
    setPurchaseUrl(p.purchaseLinks?.[0]?.url ?? p.purchaseUrl ?? "");
    setStepInciAnalysis(p.inciAnalysis);
    setCatalogSearch("");
    setShowCatalogPicker(false);
  }

  async function handleImageFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });
      const { publicUrl } = await uploadProductImageFn({
        data: { fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      setImageUrl(publicUrl);
    } catch (err: any) {
      setUploadError(err?.message ?? "Erreur lors de l'upload — réessaye.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={!!step} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col rounded-3xl sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl">
            {isNew ? "Ajouter une étape" : "Modifier l'étape"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 py-2">
            {/* Catalog picker */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/80">Depuis le catalogue</label>
                <button
                  type="button"
                  onClick={() => setShowCatalogPicker((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Package className="h-3 w-3" />
                  {showCatalogPicker ? "Fermer" : "Choisir un produit"}
                </button>
              </div>
              {showCatalogPicker && (
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <SearchInput
                    value={catalogSearch}
                    onChange={setCatalogSearch}
                    placeholder="Rechercher dans le catalogue…"
                    inputClassName="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
                    showWhenEmpty
                    clearOnSelect={false}
                    suggestions={catalogResults.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: p.brand ? `${p.brand} · ${p.category}` : p.category,
                      imageUrl: p.imageUrl,
                      onSelect: () => fillFromCatalog(p),
                    }))}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Produit</label>
              <input
                autoComplete="off"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="ex. Hydrating Cleanser"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">
                Marque <span className="font-normal text-muted-foreground">(optionnelle)</span>
              </label>
              <input
                autoComplete="off"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="ex. CeraVe"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">Instructions</label>
              <textarea

                autoComplete="off"                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="ex. Appliquer sur peau humide, masser doucement 30 s puis rincer."
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">
                Image du produit{" "}
                <span className="font-normal text-muted-foreground">(optionnelle)</span>
              </label>
              {imageUrl ? (
                <div className="relative inline-block">
                  <img
                    src={imageUrl}
                    alt="Aperçu produit"
                    className="h-24 w-24 rounded-2xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : uploading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Upload en cours…</span>
                </div>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground">
                    <Upload className="h-4 w-4 shrink-0" />
                    Choisir une image
                    <input

                      autoComplete="off"                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />
                  </label>
                  {uploadError && <p className="mt-1.5 text-xs text-destructive">{uploadError}</p>}
                </>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">
                Lien d'achat{" "}
                <span className="font-normal text-muted-foreground">(URL optionnelle)</span>
              </label>
              <input
                autoComplete="off"
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Pourquoi ce produit */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground/80">
                Pourquoi ce produit{" "}
                <span className="font-normal text-muted-foreground">(visible par l'élève)</span>
              </label>
              <textarea
                autoComplete="off"
                value={whyThisProduct}
                onChange={(e) => setWhyThisProduct(e.target.value)}
                placeholder="ex : L'avoine apaise les rougeurs. Le panthénol répare la barrière cutanée. Assez léger pour ne pas boucher les pores."
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Instauration progressive */}
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Instauration progressive</p>
                <span className="text-xs text-muted-foreground">(optionnel)</span>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Semaine d'introduction</label>
                <input
                  autoComplete="off"
                  type="number"
                  min={1}
                  max={52}
                  value={startWeek}
                  onChange={(e) => setStartWeek(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="ex : 3"
                  className="h-9 w-28 rounded-xl border border-border bg-background px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Note de progression</label>
                <textarea
                  autoComplete="off"
                  value={introNote}
                  onChange={(e) => setIntroNote(e.target.value)}
                  placeholder="ex : Commencer 2x/sem. pendant 3 semaines avant d'augmenter la fréquence"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() =>
              onSaveToCatalog({
                category,
                product,
                brand: brand.trim() || undefined,
                instructions,
                imageUrl: imageUrl.trim() || undefined,
                purchaseUrl: purchaseUrl.trim() || undefined,
              })
            }
            /* introNote/startWeek are student-specific, not saved to catalogue */
            disabled={savingToCatalog || !product.trim()}
            className="mr-auto flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {savingToCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Catalogue
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              onSave({
                category,
                product,
                brand: brand.trim() || undefined,
                instructions,
                imageUrl: imageUrl.trim() || undefined,
                purchaseUrl: purchaseUrl.trim() || undefined,
                startWeek: startWeek !== "" ? startWeek : undefined,
                introNote: introNote.trim() || undefined,
                whyThisProduct: whyThisProduct.trim() || undefined,
                inciAnalysis: stepInciAnalysis,
              })
            }
            disabled={saving || !product.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Ajouter" : "Sauvegarder"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
