import { createServerFn } from "@tanstack/react-start";

// ─── Barcode lookup (inciapi.com → fallback Open Beauty Facts) ────────────────

export type BarcodeResult = {
  productName: string | null;
  brand: string | null;
  inci: string | null;
  imageUrl: string | null;
};

async function lookupInciApi(barcode: string): Promise<BarcodeResult | null> {
  const apiKey = process.env.INCI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`https://inciapi.com/v1/products/${encodeURIComponent(barcode)}`, {
    headers: { "X-API-Key": apiKey },
    signal: AbortSignal.timeout(7000),
  });

  // 404 = not in their DB yet → signal to try fallback
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
  const p = json?.product;
  if (!p) return null;

  const inciArray: string[] = p?.details?.inci ?? [];
  const inci = inciArray.length > 0 ? inciArray.join(", ") : null;

  return {
    productName: (p.name as string) || null,
    brand: (p.brand as string) || null,
    inci,
    imageUrl: (p.image ?? p.imageUrl ?? p.image_url ?? null) as string | null,
  };
}

async function lookupOpenBeautyFacts(barcode: string): Promise<BarcodeResult | null> {
  const res = await fetch(
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,ingredients_text,image_url`,
    {
      headers: { "User-Agent": "ProtocoleClear/1.0 (contact@protocole-clear.com)" },
      signal: AbortSignal.timeout(7000),
    }
  );
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || json.status !== 1) return null;
  const p = json.product ?? {};
  return {
    productName: (p.product_name as string) || null,
    brand: (p.brands as string) || null,
    inci: (p.ingredients_text as string) || null,
    imageUrl: (p.image_url as string) || null,
  };
}

export const lookupBarcodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { barcode: string }) => d)
  .handler(async (ctx): Promise<BarcodeResult | null> => {
    const { barcode } = ctx.data;
    const inciResult = await lookupInciApi(barcode).catch(() => null);
    if (inciResult?.inci) return inciResult;
    return lookupOpenBeautyFacts(barcode).catch(() => null);
  });

// ─── URL ingestion (AI-assisted INCI extraction from HTML) ────────────────────

export type UrlExtractResult = {
  inci: string | null;
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
};

export const extractInciFromUrlFn = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string; callerToken: string }) => d)
  .handler(async (ctx): Promise<UrlExtractResult> => {
    // Authenticated users only (analyzer is open to all members), and SSRF guard
    // on the target URL before any server-side fetch.
    const { requireAuth, assertSafeUrl } = await import("@/lib/server-auth");
    await requireAuth(ctx.data.callerToken);
    assertSafeUrl(ctx.data.url);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("SERVICE_UNAVAILABLE");

    // ── Fetch the page (direct → Jina Reader fallback) ────────────────────────
    let pageText: string;
    let ogImage: string | null = null;

    const BOT_CHALLENGE_SIGNALS = ["Just a moment", "Performing security verification", "Enable JavaScript", "cf-browser-verification"];

    async function fetchDirect(url: string): Promise<string | null> {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "fr-FR,fr;q=0.9",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const html = await res.text();
        // Reject bot-challenge pages (too small or Cloudflare challenge)
        if (html.length < 3000 || BOT_CHALLENGE_SIGNALS.some((s) => html.includes(s))) return null;
        return html;
      } catch {
        return null;
      }
    }

    async function fetchViaJina(url: string): Promise<string | null> {
      try {
        const res = await fetch(`https://r.jina.ai/${url}`, {
          headers: { Accept: "text/plain", "X-Return-Format": "text" },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return null;
        const text = await res.text();
        if (BOT_CHALLENGE_SIGNALS.some((s) => text.includes(s)) || text.includes("requiring CAPTCHA")) return null;
        return text;
      } catch {
        return null;
      }
    }

    const rawHtml = await fetchDirect(ctx.data.url);

    if (rawHtml) {
      // Direct fetch succeeded — extract og:image then strip to plain text
      const ogMatch = rawHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        ?? rawHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      ogImage = ogMatch?.[1] ?? null;

      const jsonLdMatch = rawHtml.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      const jsonLdText = jsonLdMatch ? jsonLdMatch.join(" ") : "";

      pageText = (jsonLdText + " " + rawHtml)
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 14000);
    } else {
      // Fallback: Jina Reader (handles JS-rendered pages and bypasses most Cloudflare)
      const jinaText = await fetchViaJina(ctx.data.url);
      if (!jinaText) throw new Error("PAGE_INACCESSIBLE");
      pageText = jinaText.slice(0, 14000);
    }

    // ── GPT extraction ────────────────────────────────────────────────────────
    let parsed: any;
    try {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are a cosmetic ingredient extractor. From the page text, find: (1) the full INCI ingredient list (ingredients listed after "INCI" or "Ingrédients" or "Ingredients" or "Composition"), (2) product name, (3) brand. Return ONLY valid JSON: {"inci": "WATER, GLYCERIN, ...", "productName": "...", "brand": "..."}. If the INCI list is absent from the text, set "inci" to null.`,
            },
            { role: "user", content: pageText },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!gptRes.ok) throw new Error("SERVICE_UNAVAILABLE");
      const gptJson = await gptRes.json().catch(() => null);
      const content = gptJson?.choices?.[0]?.message?.content ?? "{}";
      parsed = JSON.parse(content);
    } catch (e: any) {
      if (e?.message === "SERVICE_UNAVAILABLE") throw e;
      throw new Error("SERVICE_UNAVAILABLE");
    }

    // If nothing at all was extracted, throw so the caller shows a hard error
    if (!parsed?.inci && !parsed?.productName && !parsed?.brand) {
      throw new Error("INCI_NOT_FOUND");
    }

    return {
      inci: (parsed.inci as string) || null,
      productName: (parsed.productName as string) || null,
      brand: (parsed.brand as string) || null,
      imageUrl: ogImage,
    };
  });
