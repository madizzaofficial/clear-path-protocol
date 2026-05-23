// Normalize INCI text to a canonical form (same split logic as the analysis engine)
export function normalizeInciText(raw: string): string {
  return raw
    .split(/(?<!\d),(?!\d)|\n|(?<!\d)\.\s+/)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, ""))
    .filter(Boolean)
    .join(", ");
}

// SHA-256 hash of the normalized INCI — used as the product's unique identity key
export async function computeInciHash(raw: string): Promise<string> {
  const normalized = normalizeInciText(raw);
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Server-side (Node.js)
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
