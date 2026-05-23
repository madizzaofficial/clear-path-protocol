import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { SkinProfile } from "./cosmetic-ingredients";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CachedProduct = {
  hash: string;
  inciNormalized: string;      // canonical INCI text for re-analysis
  productName: string | null;
  brand: string | null;
  barcode: string | null;
  sourceUrl: string | null;
  aiSummaries: Record<string, string>; // profileKey → cached AI explanation
  createdAt: number;
  updatedAt: number;
};

// ─── Profile key ──────────────────────────────────────────────────────────────

export function makeProfileKey(profile: SkinProfile): string {
  const parts = [
    profile.skinType ?? "",
    profile.intensity ?? "",
    ...(profile.acneTypes ?? []).slice().sort(),
  ];
  return parts.filter(Boolean).join("_") || "default";
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProductCache(hash: string): Promise<CachedProduct | null> {
  try {
    const snap = await getDoc(doc(db, "products_cache", hash));
    return snap.exists() ? (snap.data() as CachedProduct) : null;
  } catch {
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveProductCache(
  hash: string,
  inciNormalized: string,
  meta: {
    productName?: string | null;
    brand?: string | null;
    barcode?: string | null;
    sourceUrl?: string | null;
  }
): Promise<void> {
  try {
    const ref = doc(db, "products_cache", hash);
    const existing = await getDoc(ref);
    if (existing.exists()) return; // already cached — don't overwrite
    await setDoc(ref, {
      hash,
      inciNormalized,
      productName: meta.productName ?? null,
      brand: meta.brand ?? null,
      barcode: meta.barcode ?? null,
      sourceUrl: meta.sourceUrl ?? null,
      aiSummaries: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } satisfies CachedProduct);
  } catch {
    // non-critical
  }
}

export async function saveAiSummary(hash: string, profileKey: string, summary: string): Promise<void> {
  try {
    const ref = doc(db, "products_cache", hash);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() as CachedProduct;
    await setDoc(ref, {
      ...data,
      aiSummaries: { ...data.aiSummaries, [profileKey]: summary },
      updatedAt: Date.now(),
    });
  } catch {
    // non-critical
  }
}
