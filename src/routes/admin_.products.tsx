import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { SearchInput } from "@/components/SearchInput";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LayoutGrid,
  LayoutList,
  Loader2,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
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
import { lookupBarcodeFn, extractInciFromUrlFn } from "@/lib/product-ingestion";
import { computeInciHash, normalizeInciText } from "@/lib/inci-hash";
import type { CatalogProduct } from "@/lib/product-catalog";
import { LiveBarcodeScanner } from "@/components/LiveBarcodeScanner";

// Re-export so existing imports in RoutineStepEditor and admin routes keep working
export type { CatalogProduct } from "@/lib/product-catalog";

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
  const navigate = useNavigate();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUnverified, setFilterUnverified] = useState(false);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("catalog_view") as "grid" | "list") ?? "grid"
  );

  function setViewModePersisted(mode: "grid" | "list") {
    localStorage.setItem("catalog_view", mode);
    setViewMode(mode);
  }
  const [page, setPage] = useState(0);

  const PAGE_SIZE = viewMode === "grid" ? 24 : 50;

  useEffect(() => {
    getDocs(collection(db, "admin_products"))
      .then((snap) => setProducts(snap.docs.map((d) => d.data() as CatalogProduct)))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Reset to page 0 whenever filters or view mode change
  useEffect(() => { setPage(0); }, [filterCategory, filterUnverified, search, viewMode]);

  const unverifiedCount = useMemo(() => products.filter((p) => p.verified === false).length, [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (filterCategory !== "all") result = result.filter((p) => p.category === filterCategory);
    if (filterUnverified) result = result.filter((p) => p.verified === false);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products, filterCategory, filterUnverified, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openNew() {
    setIsNewProduct(true);
    setEditingProduct({
      id: crypto.randomUUID(),
      name: "",
      category: CATEGORIES[0],
      instructions: "",
      verified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  async function handleQuickVerify(id: string) {
    await setDoc(doc(db, "admin_products", id), { verified: true, updatedAt: Date.now() }, { merge: true });
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, verified: true } : p)));
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
        verified: true,
        updatedAt: Date.now(),
      };
      // Firestore rejects undefined values — strip them before writing
      const clean = Object.fromEntries(
        Object.entries(updated).filter(([, v]) => v !== undefined)
      ) as CatalogProduct;
      await setDoc(doc(db, "admin_products", updated.id), clean);
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Catalogue produits
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Produits réutilisables pour la création des routines clients.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => (navigate as any)({ to: "/admin/unclassified" })}
                className="flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Ingrédients non classifiés
              </button>
              <button
                onClick={openNew}
                className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                Nouveau produit
              </button>
            </div>
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
          <button
            onClick={() => setFilterUnverified((v) => !v)}
            className={`flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
              filterUnverified
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Non vérifiés
            {unverifiedCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                filterUnverified ? "bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300" : "bg-muted text-muted-foreground"
              }`}>
                {unverifiedCount}
              </span>
            )}
          </button>

          {/* View toggle */}
          <div className="ml-auto flex h-10 items-center gap-0.5 rounded-2xl border border-border bg-background p-1">
            <button
              onClick={() => setViewModePersisted("grid")}
              title="Vue grille"
              className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewModePersisted("list")}
              title="Vue liste"
              className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>
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
        ) : viewMode === "grid" ? (
          <>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {paginated.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeletingId(p.id)}
                  onVerify={() => handleQuickVerify(p.id)}
                />
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        ) : (
          <>
            <div className="rounded-3xl border border-border/60 bg-card shadow-soft overflow-hidden">
              <div className="border-b border-border/60 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} produit{filtered.length > 1 ? "s" : ""}
                  {filtered.length > PAGE_SIZE && (
                    <span className="ml-1 text-muted-foreground/60">
                      — affichage {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}
                    </span>
                  )}
                </p>
              </div>
              <ul className="divide-y divide-border/40">
                {paginated.map((p) => (
                  <ProductListItem
                    key={p.id}
                    product={p}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeletingId(p.id)}
                    onVerify={() => handleQuickVerify(p.id)}
                  />
                ))}
              </ul>
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
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

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  // Build page number list: always show first, last, current ±1, with "…" gaps
  const pages: (number | "…")[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {from}–{to} sur {total} produit{total > 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`flex h-8 min-w-[2rem] items-center justify-center rounded-xl px-2 text-xs font-medium transition-colors ${
                p === page
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {(p as number) + 1}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
  onVerify,
}: {
  product: CatalogProduct;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: () => void;
}) {
  return (
    <li onClick={onEdit} className="group relative flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-t-3xl bg-muted">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full rounded-t-3xl object-contain p-2"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {product.verified === false && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            Non vérifié
          </span>
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
        {product.brand && (
          <p className="text-xs text-muted-foreground font-medium">{product.brand}</p>
        )}
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
        {product.verified === false && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onVerify(); }}
              title="Marquer comme vérifié"
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vérifier</span>
            </button>
            <div className="w-px bg-border" />
          </>
        )}
        <button
          onClick={onEdit}
          title="Modifier"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Modifier</span>
        </button>
        <div className="w-px bg-border" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Supprimer"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Supprimer</span>
        </button>
      </div>
    </li>
  );
}

// ─── Product List Item (compact view) ────────────────────────────────────────

function ProductListItem({
  product,
  onEdit,
  onDelete,
  onVerify,
}: {
  product: CatalogProduct;
  onEdit: () => void;
  onDelete: () => void;
  onVerify: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      {/* Thumbnail */}
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-full w-full rounded-xl object-contain p-0.5" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff className="h-4 w-4 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
          {product.verified === false && (
            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              Non vérifié
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {product.brand && <span className="text-xs text-muted-foreground font-medium">{product.brand}</span>}
          {product.brand && <span className="text-muted-foreground/30 text-xs">·</span>}
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{product.category}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {product.verified === false && (
          <button
            onClick={(e) => { e.stopPropagation(); onVerify(); }}
            title="Vérifier"
            className="flex h-7 w-7 items-center justify-center rounded-xl text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onEdit}
          title="Modifier"
          className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Supprimer"
          className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
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
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [inciNormalized, setInciNormalized] = useState("");
  const [showInci, setShowInci] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setBrand(product.brand ?? "");
      setBarcode(product.barcode ?? "");
      setImportUrl("");
      setCategory(product.category || CATEGORIES[0]);
      setDescription(product.description ?? "");
      setInstructions(product.instructions);
      setImageUrl(product.imageUrl ?? "");
      setPurchaseUrl(product.purchaseUrl ?? "");
      setInciNormalized(product.inciNormalized ?? "");
      setShowInci(!!product.inciNormalized);
      setShowScanner(false);
      setUploadError(null);
      setUploading(false);
      setImporting(false);
      setImportError(null);
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

  async function handleImportBarcode() {
    if (!barcode.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await lookupBarcodeFn({ data: { barcode: barcode.trim() } });
      if (!result) { setImportError("Produit non trouvé pour ce code-barres."); return; }
      if (result.productName) setName(result.productName);
      if (result.brand) setBrand(result.brand);
      if (result.imageUrl) setImageUrl(result.imageUrl);
      if (result.inci) { setInciNormalized(result.inci); setShowInci(true); }
      if (!result.inci) setImportError("Produit trouvé mais sans liste INCI.");
    } catch {
      setImportError("Erreur lors de la recherche.");
    } finally {
      setImporting(false);
    }
  }

  async function handleExtractUrl() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await extractInciFromUrlFn({ data: { url: importUrl.trim() } });
      if (result.productName) setName(result.productName);
      if (result.brand) setBrand(result.brand);
      if (result.imageUrl) setImageUrl(result.imageUrl);
      if (result.inci) { setInciNormalized(result.inci); setShowInci(true); }
      // Partial result: name/brand extracted but INCI in a JS-rendered tab
      if (!result.inci) setImportError("Ingrédients non trouvés (onglet dynamique). Nom/marque pré-remplis — colle la composition manuellement.");
    } catch (err: any) {
      const msg: Record<string, string> = {
        INCI_NOT_FOUND: "Aucune donnée trouvée. Essaie une URL InciDecoder ou colle la liste manuellement.",
        PAGE_INACCESSIBLE: "Page inaccessible ou bloquée. Essaie une URL InciDecoder.",
        SERVICE_UNAVAILABLE: "Service temporairement indisponible.",
      };
      setImportError(msg[err?.message] ?? "Erreur lors de l'extraction.");
    } finally {
      setImporting(false);
    }
  }

  async function handleScanDetected(code: string) {
    setShowScanner(false);
    setBarcode(code);
    // Auto-import immediately after scan
    setImporting(true);
    setImportError(null);
    try {
      const result = await lookupBarcodeFn({ data: { barcode: code } });
      if (!result) { setImportError("Produit non trouvé pour ce code-barres."); return; }
      if (result.productName) setName(result.productName);
      if (result.brand) setBrand(result.brand);
      if (result.imageUrl) setImageUrl(result.imageUrl);
      if (result.inci) { setInciNormalized(result.inci); setShowInci(true); }
      if (!result.inci) setImportError("Produit trouvé mais sans liste INCI.");
    } catch {
      setImportError("Erreur lors de la recherche.");
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit() {
    let hash: string | undefined;
    if (inciNormalized.trim()) {
      hash = await computeInciHash(normalizeInciText(inciNormalized.trim())).catch(() => undefined);
    }
    onSave({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      instructions,
      imageUrl: imageUrl.trim() || undefined,
      purchaseUrl: purchaseUrl.trim() || undefined,
      brand: brand.trim() || undefined,
      barcode: barcode.trim() || undefined,
      inciNormalized: inciNormalized.trim() ? normalizeInciText(inciNormalized.trim()) : undefined,
      inciHash: hash,
      verified: true,
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
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. CeraVe Hydrating Cleanser"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Brand */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Marque <span className="font-normal text-muted-foreground">(optionnelle)</span>
            </label>
            <input
              autoComplete="off"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="ex. CeraVe, La Roche-Posay…"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Barcode + scan + import */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Code-barres <span className="font-normal text-muted-foreground">(EAN/UPC)</span>
            </label>
            {showScanner ? (
              <LiveBarcodeScanner
                onDetect={handleScanDetected}
                onClose={() => setShowScanner(false)}
              />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoComplete="off"
                  inputMode="numeric"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="3600523459858"
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    title="Scanner avec la caméra"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleImportBarcode}
                    disabled={!barcode.trim() || importing}
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Importer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* URL import */}
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Importer depuis une URL <span className="font-normal text-muted-foreground">(page produit)</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoComplete="off"
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://incidecoder.com/products/…"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={handleExtractUrl}
                disabled={!importUrl.trim() || importing}
                className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Extraire
              </button>
            </div>
          </div>

          {importError && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {importError}
            </p>
          )}

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
              autoComplete="off"
              value={description}
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
              autoComplete="off"
              value={instructions}
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
                    autoComplete="off"
                    type="file"
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
              autoComplete="off"
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://..."
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Collapsible INCI section */}
          <div className="rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => setShowInci((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/50 rounded-2xl"
            >
              <span className="flex items-center gap-2">
                Composition INCI
                {inciNormalized && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    renseignée
                  </span>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showInci ? "rotate-180" : ""}`} />
            </button>
            {showInci && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                <textarea
                  autoComplete="off"
                  value={inciNormalized}
                  onChange={(e) => setInciNormalized(e.target.value)}
                  rows={5}
                  placeholder="Water, Glycerin, Niacinamide, ..."
                  className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-xs leading-relaxed outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
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
