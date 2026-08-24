import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: false,
    // Build dist/ once before the suite — CLI in-process + E2E tests load the
    // built package (the realistic dual-bundle path).
    globalSetup: ["test/global-setup.ts"],
    // Type-level tests (layer 3) run only under `vitest --typecheck`.
    typecheck: {
      include: ["test/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/index.ts", // 12-line bin bootstrap; exercised by the E2E spawn tests
        "src/**/*.d.ts",
      ],
      reporter: ["text", "html"],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 95,
      },
    },
  },
});
