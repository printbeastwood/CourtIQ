import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve @courtiq/db/schema to the source file so Vitest can transform it
      "@courtiq/db/schema": path.resolve(
        __dirname,
        "../../packages/db/src/schema.ts"
      ),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
