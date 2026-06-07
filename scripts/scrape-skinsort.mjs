/**
 * Scrape ingredient flags from skinsort.com for all classified ingredients.
 * Usage: node scripts/scrape-skinsort.mjs
 *
 * Output: scripts/skinsort-results.json
 * Requires: npm install playwright (or npx playwright install chromium)
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load ingredient names from our database ──────────────────────────────────

const src = readFileSync(join(__dirname, "../src/lib/cosmetic-ingredients.ts"), "utf8");

function extractNames(blockName) {
  const start = src.indexOf(`export const ${blockName}`);
  if (start === -1) return [];
  let depth = 0, i = src.indexOf("{", start), begin = i;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    if (src[i] === "}") { depth--; if (depth === 0) break; }
    i++;
  }
  const block = src.slice(begin, i + 1);
  return [...block.matchAll(/"([A-Z][A-Z0-9 \-\/]+)":/g)].map(m => m[1]);
}

const allIngredients = [
  ...new Set([
    ...extractNames("ENDOCRINE_DISRUPTORS"),
    ...extractNames("ALLERGENS"),
    ...extractNames("IRRITANTS"),
    ...extractNames("PETROCHEMICALS"),
    ...extractNames("COMEDOGENIC_INGREDIENTS"),
  ])
];

console.log(`Scraping ${allIngredients.length} ingredients from skinsort.com…\n`);

// ─── Slug conversion ──────────────────────────────────────────────────────────

function toSlug(inci) {
  return inci.toLowerCase().replace(/\//g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

const DELAY_MS = 1500; // polite delay between requests

async function scrapeIngredient(page, name) {
  const slug = toSlug(name);
  const url = `https://skinsort.com/ingredients/${slug}`;

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

    if (!response || response.status() === 404) {
      return { name, slug, status: "not_found", flags: [], rating: null };
    }

    // Wait for real content (not Cloudflare challenge)
    try {
      await page.waitForSelector("article h1", { timeout: 12000 });
    } catch {
      // Check if it's a Cloudflare challenge page
      const title = await page.title();
      if (title.includes("moment") || title.includes("Cloudflare")) {
        await page.waitForSelector("article h1", { timeout: 20000 });
      } else {
        return { name, slug, status: "not_found", flags: [], rating: null };
      }
    }

    const data = await page.evaluate(() => {
      const article = document.querySelector("article");
      if (!article) return null;

      // Rating — first line of article text before h1
      const articleText = article.innerText.trim();
      const firstLine = articleText.split("\n")[0].trim();
      const ratingText = ["Loved", "Liked", "Mixed", "Disliked", "Very Disliked"].includes(firstLine)
        ? firstLine : null;

      // Flags — buttons that are NOT "Got it!" or navigation
      const SKIP = new Set(["Got it!", "View", "Show", "More", "Less"]);
      const flags = [...article.querySelectorAll("button")]
        .map(b => b.textContent.trim())
        .filter(t => t.length > 2 && t.length < 60 && !SKIP.has(t));

      return { flags, ratingText };
    });

    if (!data) return { name, slug, status: "parse_error", flags: [], rating: null };

    return {
      name,
      slug,
      status: "ok",
      flags: data.flags,
      rating: data.ratingText,
      url,
    };
  } catch (err) {
    return { name, slug, status: "error", error: err.message, flags: [], rating: null };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({
  headless: false,
  args: ["--disable-blink-features=AutomationControlled"],
});
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 },
  locale: "en-US",
});
const page = await context.newPage();

// First load — wait for Cloudflare to pass and accept cookies
console.log("Opening browser… wait for the page to fully load then the scraping starts automatically.\n");
await page.goto("https://skinsort.com/ingredients/glycerin", { waitUntil: "domcontentloaded" });
await page.waitForSelector("article h1", { timeout: 30000 });
await page.getByRole("button", { name: /accepter|accept all|tout accepter/i }).click().catch(() => {});
await page.waitForTimeout(1500);

const results = [];
let ok = 0, notFound = 0, errors = 0;

for (let i = 0; i < allIngredients.length; i++) {
  const name = allIngredients[i];
  process.stdout.write(`[${i + 1}/${allIngredients.length}] ${name}… `);

  const result = await scrapeIngredient(page, name);
  results.push(result);

  if (result.status === "ok") { ok++; process.stdout.write(`✓ (${result.flags.length} flags)\n`); }
  else if (result.status === "not_found") { notFound++; process.stdout.write(`— not found\n`); }
  else { errors++; process.stdout.write(`✗ ${result.error ?? result.status}\n`); }

  await page.waitForTimeout(DELAY_MS);
}

await browser.close();

// ─── Save results ─────────────────────────────────────────────────────────────

const output = {
  scrapedAt: new Date().toISOString(),
  total: results.length,
  found: ok,
  notFound,
  errors,
  results,
};

const outPath = join(__dirname, "skinsort-results.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`\n✓ Done — ${ok} found, ${notFound} not found, ${errors} errors`);
console.log(`Results saved to scripts/skinsort-results.json`);
