/**
 * Post-build script: converts the Vite output into Vercel Build Output API format.
 *
 * Input:  dist/client/  (static assets)
 *         dist/server/  (server entry — fetch API format)
 *
 * Output: .vercel/output/static/              (static files served by CDN)
 *         .vercel/output/functions/index.func/ (Node.js serverless function)
 *         .vercel/output/config.json           (routing rules)
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

console.log("→ Bundling server into Node.js function…");

// Wrap the fetch-API server module in a standard Node.js HTTP handler.
// The Vite/TanStack Start server uses node:stream internally, which is not
// available in the Vercel edge runtime — so we use nodejs20.x instead.
await build({
  stdin: {
    contents: `
import serverModule from "./dist/server/server.js";

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  const url   = proto + "://" + host + req.url;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const hasBody = chunks.length > 0 && req.method !== "GET" && req.method !== "HEAD";

  const webReq = new Request(url, {
    method:  req.method,
    headers: req.headers,
    body:    hasBody ? Buffer.concat(chunks) : undefined,
  });

  const webRes = await serverModule.fetch(webReq);

  // Strip hop-by-hop headers Node.js manages automatically
  const skip = new Set(["transfer-encoding", "connection", "keep-alive"]);
  const headers = {};
  for (const [k, v] of webRes.headers.entries()) {
    if (!skip.has(k.toLowerCase())) headers[k] = v;
  }

  res.writeHead(webRes.status, headers);
  res.end(Buffer.from(await webRes.arrayBuffer()));
}
`,
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  outfile: resolve(funcDir, "index.js"),
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["node:*"],
  minify: true,
  logLevel: "info",
});

console.log("→ Copying static assets…");
await cp(resolve(root, "dist/client"), resolve(outDir, "static"), { recursive: true });

console.log("→ Writing Vercel function config…");
await writeFile(
  resolve(funcDir, ".vc-config.json"),
  JSON.stringify(
    { runtime: "nodejs20.x", handler: "index.js", launcherType: "Nodejs" },
    null,
    2
  )
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
        // Everything else → Node.js serverless function (SSR + server fns + Inngest)
        { src: "^/(.*)$", dest: "/index" },
      ],
    },
    null,
    2
  )
);

console.log("✓ Vercel output ready at .vercel/output/");
