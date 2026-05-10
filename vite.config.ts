// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// cloudflare: false → disables @cloudflare/vite-plugin so the build targets Node.js
// (Vercel deployment). Without this, the output is a Cloudflare Worker that Vercel
// cannot serve.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {},
});
