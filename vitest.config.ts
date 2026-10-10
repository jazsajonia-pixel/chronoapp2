import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/** Logic tests (no React Native runtime): node environment, same as Hermes — no DOM globals. */
export default defineConfig({
  resolve: { alias: [{ find: /^@\//, replacement: resolve(__dirname, "src") + "/" }] },
  test: { environment: "node", include: ["src/**/*.test.ts"], setupFiles: ["src/test/setup.ts"] },
});
