/**
 * Export all classified ingredients as JSON for external review.
 * Usage: node scripts/export-ingredients-for-review.mjs > ingredients-review.json
 *
 * Output format designed for DeepSeek review prompt:
 * Ask DeepSeek to verify each entry against SCCS/ECHA/CosIng sources and return
 * a JSON array with { name, currentCategory, currentSeverity, verdict, correction?, source }
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "../src/lib/cosmetic-ingredients.ts");
const raw = readFileSync(src, "utf8");

// ─── Simple regex extractor ───────────────────────────────────────────────────

function extractBlock(name) {
  const start = raw.indexOf(`export const ${name}`);
  if (start === -1) return {};
  let depth = 0;
  let i = raw.indexOf("{", start);
  const begin = i;
  while (i < raw.length) {
    if (raw[i] === "{") depth++;
    if (raw[i] === "}") { depth--; if (depth === 0) break; }
    i++;
  }
  const block = raw.slice(begin, i + 1);
  const entries = {};
  const lineRe = /"([^"]+)":\s*\{([^}]+)\}/g;
  let m;
  while ((m = lineRe.exec(block)) !== null) {
    const key = m[1];
    const body = m[2];
    const severity = (body.match(/"severity":\s*"([^"]+)"/) || [])[1];
    const reason = (body.match(/reason":\s*"([^"]+)"/) || [])[1];
    entries[key] = { severity, reason };
  }
  return entries;
}

// ─── Build export ─────────────────────────────────────────────────────────────

const ed = extractBlock("ENDOCRINE_DISRUPTORS");
const allergens = extractBlock("ALLERGENS");
const irritants = extractBlock("IRRITANTS");
const petrochem = extractBlock("PETROCHEMICALS");

// Comedogenic needs different extraction (has rating field)
const comedoBlock = raw.slice(
  raw.indexOf("export const COMEDOGENIC_INGREDIENTS"),
  raw.indexOf("\n};\n", raw.indexOf("export const COMEDOGENIC_INGREDIENTS")) + 3
);
const comedoEntries = {};
const comedoRe = /"([^"]+)":\s*\{\s*rating:\s*(\d)/g;
let cm;
while ((cm = comedoRe.exec(comedoBlock)) !== null) {
  comedoEntries[cm[1]] = { rating: Number(cm[2]) };
}

const output = {
  meta: {
    exportedAt: new Date().toISOString(),
    reviewPrompt: [
      "Pour chaque ingrédient ci-dessous, vérifie la classification actuelle.",
      "Sources à utiliser par ordre de priorité : SCCS (Comité Scientifique EU), ECHA, CosIng (base EU), PubMed.",
      "Pour chaque entrée, retourne un objet JSON avec :",
      "  name: string (nom INCI exact)",
      "  category: 'endocrine_disruptor' | 'allergen' | 'irritant' | 'petrochem' | 'comedogenic'",
      "  currentSeverity: string (valeur actuelle)",
      "  verdict: 'correct' | 'à_retirer' | 'à_modifier'",
      "  correction?: string (si à_modifier — nouvelle valeur severity/reason)",
      "  source: string (ex: 'SCCS 2021 opinion', 'ECHA SVHC list')",
      "  note?: string (contexte utile)",
    ].join("\n"),
  },
  endocrine_disruptors: Object.entries(ed).map(([name, v]) => ({
    name,
    category: "endocrine_disruptor",
    currentSeverity: v.severity,
    currentReason: v.reason,
  })),
  allergens: Object.entries(allergens).map(([name, v]) => ({
    name,
    category: "allergen",
    currentReason: v.reason,
  })),
  irritants: Object.entries(irritants).map(([name, v]) => ({
    name,
    category: "irritant",
    currentReason: v.reason,
  })),
  petrochemicals: Object.entries(petrochem).map(([name]) => ({
    name,
    category: "petrochem",
  })),
  comedogenic: Object.entries(comedoEntries).map(([name, v]) => ({
    name,
    category: "comedogenic",
    currentRating: v.rating,
  })),
};

console.log(JSON.stringify(output, null, 2));
