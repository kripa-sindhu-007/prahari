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
      // json-summary + json feed the CI coverage report (job summary + PR comment);
      // html is the downloadable artifact; text prints in the run logs.
      reporter: ["text", "html", "json", "json-summary"],
      reportOnFailure: true,
      // The suite runs well above these; the floor is what CI enforces so a
      // change cannot quietly land uncovered.
      thresholds: {
        lines: 97,
        functions: 97,
        statements: 97,
        branches: 97,
      },
    },
  },
});
