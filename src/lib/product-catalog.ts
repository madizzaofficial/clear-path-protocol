import { db } from "./firebase";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseLink = { url: string; label: string };

export type CatalogProduct = {
  id: string;
  name: string;
  category: string;
  description?: string;
  instructions: string;
  imageUrl?: string;
  /** @deprecated use purchaseLinks instead */
  purchaseUrl?: string;
  purchaseLinks?: PurchaseLink[];
  brand?: string;
  barcode?: string;
  inciNormalized?: string;
  inciHash?: string;
  verified: boolean;
  isFeatured?: boolean;
  createdAt: number;
  updatedAt: number;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getCatalogProductByBarcode(barcode: string): Promise<CatalogProduct | null> {
  const snap = await getDocs(query(collection(db, "admin_products"), where("barcode", "==", barcode)));
  if (snap.empty) return null;
  return snap.docs[0].data() as CatalogProduct;
}

export async function getCatalogProductByHash(inciHash: string): Promise<CatalogProduct | null> {
  const snap = await getDocs(query(collection(db, "admin_products"), where("inciHash", "==", inciHash)));
  if (snap.empty) return null;
  return snap.docs[0].data() as CatalogProduct;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function autoSaveProductToCatalog(opts: {
  name: string | null;
  brand: string | null;
  barcode: string | null;
  inciNormalized: string | null;
  inciHash: string | null;
  imageUrl: string | null;
  category?: string;
}): Promise<void> {
  // Deduplicate — check by barcode first, then by INCI hash
  if (opts.barcode) {
    const existing = await getCatalogProductByBarcode(opts.barcode).catch(() => null);
    if (existing) return;
  }
  if (opts.inciHash) {
    const existing = await getCatalogProductByHash(opts.inciHash).catch(() => null);
    if (existing) return;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const product: CatalogProduct = {
    id,
    name: opts.name ?? "Produit inconnu",
    category: opts.category ?? "Autre",
    instructions: "",
    verified: false,
    createdAt: now,
    updatedAt: now,
  };
  if (opts.brand) product.brand = opts.brand;
  if (opts.barcode) product.barcode = opts.barcode;
  if (opts.inciNormalized) product.inciNormalized = opts.inciNormalized;
  if (opts.inciHash) product.inciHash = opts.inciHash;
  if (opts.imageUrl) product.imageUrl = opts.imageUrl;

  await setDoc(doc(db, "admin_products", id), product);
}
