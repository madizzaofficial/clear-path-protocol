import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { SearchInput } from "@/components/SearchInput";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import {
  ImageOff,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { CATEGORIES } from "@/lib/skincare-categories";
import { uploadProductImageFn } from "@/lib/upload-image";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  description?: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
  createdAt: number;
  updatedAt: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/products")({
  head: () => ({
    meta: [
      { title: "Catalogue produits — Protocole Clear" },
      { name: "description", content: "Gérez le catalogue de produits réutilisables." },
    ],
  }),
  component: ProductsPage,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function ProductsPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user || !isAdmin) return null;
  return <ProductsContent />;
}

function ProductsContent() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "admin_products"))
      .then((snap) => setProducts(snap.docs.map((d) => d.data() as CatalogProduct)))
      .finally(() => setLoadingProducts(false));
  }, []);

  const filtered = useMemo(() => {
    let result = products;
    if (filterCategory !== "all") result = result.filter((p) => p.category === filterCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products, filterCategory, search]);

  function openNew() {
    setIsNewProduct(true);
    setEditingProduct({
      id: crypto.randomUUID(),
      name: "",
      category: CATEGORIES[0],
      instructions: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  function openEdit(p: CatalogProduct) {
    setIsNewProduct(false);
    setEditingProduct({ ...p });
  }

  async function handleSave(data: Omit<CatalogProduct, "id" | "createdAt" | "updatedAt">) {
    if (!editingProduct) return;
    setSaving(true);
    try {
      const updated: CatalogProduct = {
        ...editingProduct,
        ...data,
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "admin_products", updated.id), updated);
      setProducts((prev) =>
        isNewProduct
          ? [...prev, updated]
          : prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setEditingProduct(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, "admin_products", id));
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Catalogue produits
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Produits réutilisables pour la création des routines clients.
              </p>
            </div>
            <button
              onClick={openNew}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nouveau produit
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un produit…"
            className="flex-1 min-w-48"
            suggestions={search.trim() ? products
              .filter((p) => {
                const q = search.toLowerCase();
                return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
              })
              .slice(0, 6)
              .map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: p.category,
                onSelect: () => setSearch(p.name),
              })) : []}
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-10 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Toutes les catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loadingProducts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {products.length === 0
                ? "Aucun produit dans le catalogue. Créez-en un !"
                : "Aucun résultat pour ces filtres."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeletingId(p.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Edit / create dialog */}
      <ProductDialog
        product={editingProduct}
        isNew={isNewProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le produit sera supprimé du catalogue. Les routines existantes ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
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

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: CatalogProduct;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li onClick={onEdit} className="group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {product.category}
        </span>
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
          {product.name}
        </p>
        {product.description && (
          <p className="text-xs text-muted-foreground/70 italic line-clamp-2">{product.description}</p>
        )}
        {product.instructions && (
          <p className="text-xs text-muted-foreground line-clamp-2">{product.instructions}</p>
        )}
        {product.purchaseUrl && (
          <a
            href={product.purchaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-auto text-xs font-medium text-primary hover:underline"
          >
            Lien achat →
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-border">
        <button
          onClick={onEdit}
          title="Modifier"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          Modifier
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Supprimer"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          Supprimer
        </button>
      </div>
    </li>
  );
}

// ─── Product Dialog ───────────────────────────────────────────────────────────

function ProductDialog({
  product,
  isNew,
  onClose,
  onSave,
  saving,
}: {
  product: CatalogProduct | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (data: Omit<CatalogProduct, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategory(product.category || CATEGORIES[0]);
      setDescription(product.description ?? "");
      setInstructions(product.instructions);
      setImageUrl(product.imageUrl ?? "");
      setPurchaseUrl(product.purchaseUrl ?? "");
      setUploadError(null);
      setUploading(false);
    }
  }, [product]);

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

  function handleSubmit() {
    onSave({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      instructions,
      imageUrl: imageUrl.trim() || undefined,
      purchaseUrl: purchaseUrl.trim() || undefined,
    });
  }

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Nouveau produit" : "Modifier le produit"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Nom du produit</label>
            <input

              autoComplete="off"              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. CeraVe Hydrating Cleanser"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Category */}
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

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Description <span className="font-normal text-muted-foreground">(ce que fait le produit)</span>
            </label>
            <textarea

              autoComplete="off"              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="ex. Nettoyant doux hydratant, idéal pour les peaux sensibles…"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Instructions par défaut</label>
            <textarea

              autoComplete="off"              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Comment appliquer ce produit…"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Image */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Image <span className="font-normal text-muted-foreground">(optionnelle)</span>
            </label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-20 w-20 rounded-2xl border border-border object-contain p-1"
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

                    autoComplete="off"                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFile(file);
                    }}
                  />
                </label>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-destructive">{uploadError}</p>
                )}
              </>
            )}
          </div>

          {/* Purchase URL */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Lien d'achat <span className="font-normal text-muted-foreground">(URL optionnelle)</span>
            </label>
            <input

              autoComplete="off"              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://..."
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Créer" : "Sauvegarder"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
