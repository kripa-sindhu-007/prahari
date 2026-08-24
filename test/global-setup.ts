import { execSync } from "node:child_process";

/**
 * Build `dist/` once before the test run. The CLI in-process tests and the E2E
 * spawn tests load the built package (the real dual-bundle path the registry and
 * error-brand logic must survive).
 */
export default function setup(): void {
  execSync("node_modules/.bin/tsup", { stdio: "ignore" });
}
