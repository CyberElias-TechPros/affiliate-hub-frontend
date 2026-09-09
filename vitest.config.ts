import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Frontend test configuration.
 *
 * The repository shipped with no test runner at all, so "the tests pass" was
 * never a claim that could be made. This runs the same aliases as
 * `vite.config.ts` — tests must resolve `@/` and `@shared/` exactly like the
 * app does, or they would be exercising a different module graph.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
