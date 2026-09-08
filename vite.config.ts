import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { DEFAULT_SITE_URL } from "./scripts/site-config.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // index.html substitutes %VITE_SITE_URL% into the canonical, og:url and
  // og:image tags. `.env` is gitignored, so a fresh clone has no value for it,
  // and Vite then leaves the literal `%VITE_SITE_URL%` in the HTML — which is
  // not merely wrong: `%VI` is an invalid percent-escape, so Vite's HTML parser
  // throws "URI malformed" and the build fails outright.
  //
  // Defaulting from the same constant the sitemap generator uses keeps the
  // canonicals and the sitemap on one origin. `test/seo-artifacts.test.ts`
  // asserts src/lib/config.ts agrees with it too.
  const env = loadEnv(mode, process.cwd(), "");
  if (!env.VITE_SITE_URL) {
    process.env.VITE_SITE_URL = DEFAULT_SITE_URL;
  }

  return {
  server: {
    // Bind to every interface so the sandboxed preview can reach the server.
    host: "0.0.0.0",
    port: 8080,
    // The preview is served from an arbitrary host; accept any Origin so the
    // dev server does not reject it.
    allowedHosts: true,
    hmr: {
      // Behind the preview proxy the browser reaches Vite over HTTPS on a
      // different host, so the socket must use the page's own protocol/host.
      protocol: "wss",
      clientPort: 443,
    },
    proxy: {
      // Browser code only ever calls the relative path /api/v1, and Vite
      // forwards it to the local Worker. This keeps browser-facing code free
      // of hardcoded localhost URLs, which would not resolve from the user's
      // browser.
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The API contract is shared with the Worker so the two cannot drift.
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    // Surface real regressions rather than a generic "chunks are large" note.
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        // Split the heavy third-party libraries so a change in app code does
        // not invalidate their cache, and so no single chunk is oversized.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
          charts: ["recharts"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
  },
  };
});
