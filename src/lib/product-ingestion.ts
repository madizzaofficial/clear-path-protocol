import { createServerFn } from "@tanstack/react-start";

// ─── Barcode lookup (Open Beauty Facts — free, no key) ────────────────────────

export type BarcodeResult = {
  productName: string | null;
  brand: string | null;
  inci: string | null;
};

export const lookupBarcodeFn = createServerFn({ method: "POST" })
  .inputValidator((d: { barcode: string }) => d)
  .handler(async (ctx): Promise<BarcodeResult | null> => {
    const { barcode } = ctx.data;
    const url = `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,ingredients_text`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ProtocoleClear/1.0 (contact@protocole-clear.com)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json || json.status !== 1) return null;
    const p = json.product ?? {};
    return {
      productName: (p.product_name as string) || null,
      brand: (p.brands as string) || null,
      inci: (p.ingredients_text as string) || null,
    };
  });

// ─── URL ingestion (AI-assisted INCI extraction from HTML) ────────────────────

export type UrlExtractResult = {
  inci: string;
  productName: string | null;
  brand: string | null;
};

export const extractInciFromUrlFn = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => d)
  .handler(async (ctx): Promise<UrlExtractResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("SERVICE_UNAVAILABLE");

    const pageRes = await fetch(ctx.data.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProtocoleClear/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!pageRes.ok) throw new Error("PAGE_INACCESSIBLE");

    const html = await pageRes.text();

    // Strip scripts, styles, tags — keep text only, truncate to ~3k tokens
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Extract from this cosmetic product page text: (1) the full INCI ingredient list, (2) product name, (3) brand name. Return ONLY valid JSON: {"inci": "...", "productName": "...", "brand": "..."}. If the INCI list is not found, set "inci" to null.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!gptRes.ok) throw new Error("SERVICE_UNAVAILABLE");
    const gptJson = await gptRes.json().catch(() => null);
    const parsed = JSON.parse(gptJson?.choices?.[0]?.message?.content ?? "{}");
    if (!parsed?.inci) throw new Error("INCI_NOT_FOUND");

    return {
      inci: parsed.inci as string,
      productName: (parsed.productName as string) || null,
      brand: (parsed.brand as string) || null,
    };
  });
