/**
 * Post-build script: converts the Vite output into Vercel Build Output API format.
 *
 * Input:  dist/client/  (static assets)
 *         dist/server/  (server entry + assets — fetch API format)
 *
 * Output: .vercel/output/static/   (static files served by Vercel CDN)
 *         .vercel/output/functions/index.func/  (edge function)
 *         .vercel/output/config.json            (routing rules)
 */

import { build } from "esbuild";
import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, ".vercel/output");
const funcDir = resolve(outDir, "functions/index.func");

// Clean previous output
await rm(outDir, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });

console.log("→ Bundling server into edge function…");

// Bundle dist/server/server.js (and all its local imports) into a single ESM file
await build({
  entryPoints: [resolve(root, "dist/server/server.js")],
  bundle: true,
  outfile: resolve(funcDir, "index.js"),
  format: "esm",
  platform: "browser",   // Edge runtime — Web APIs, not Node.js built-ins
  target: "es2022",
  minify: true,
  // Vercel edge functions support dynamic imports; keep them as-is
  splitting: false,
  // External packages that are available in the edge runtime
  external: ["node:*"],
  logLevel: "info",
});

console.log("→ Copying static assets…");
await cp(resolve(root, "dist/client"), resolve(outDir, "static"), { recursive: true });

console.log("→ Writing Vercel function config…");
await writeFile(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify({ runtime: "edge", entrypoint: "index.js" }, null, 2)
);

console.log("→ Writing Vercel output config…");
await writeFile(
  resolve(outDir, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Static assets (hashed filenames — long cache)
        {
          src: "^/assets/(.+)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          dest: "/assets/$1",
        },
        // Everything else → edge function (SSR + server fns + Inngest)
        { src: "^/(.*)$", dest: "/index" },
      ],
    },
    null,
    2
  )
);

console.log("✓ Vercel output ready at .vercel/output/");
