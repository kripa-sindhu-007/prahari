import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as prahari from "../src/index";

/**
 * #31 — the v1.0 API freeze, pinned as a test.
 *
 * The exported surface is a promise: adding to it is a minor release, removing
 * or renaming anything is a major one. This test is what makes that promise
 * enforceable instead of aspirational — a rename shows up as a failing diff
 * here, not as a broken import in someone else's build.
 */

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(here, "../package.json"), "utf8"),
) as { version: string; exports: Record<string, unknown> };

/** Every runtime value the main entry exports, frozen for 1.0. */
const PUBLIC_RUNTIME_API = [
  // orchestrators
  "defineEnv",
  "safeParse",
  "defineSchema",
  // built-in validators
  "str",
  "num",
  "port",
  "bool",
  "url",
  "oneOf",
  "json",
  "list",
  "duration",
  "bytes",
  "custom",
  // Standard Schema bridge
  "standard",
  "isStandardSchema",
  "isComposedSchema",
  // errors
  "EnvFieldError",
  "EnvValidationError",
  "isEnvFieldError",
  // meta
  "VERSION",
].sort();

describe("the frozen public API", () => {
  it("exports exactly the documented runtime surface — no more, no less", () => {
    expect(Object.keys(prahari).sort()).toEqual(PUBLIC_RUNTIME_API);
  });

  it("declares every entry point the package promises", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([
      ".",
      "./env-file",
      "./next",
      "./package.json",
      "./vite",
    ]);
  });

  it("keeps VERSION in step with package.json", () => {
    // Two sources of truth for the version is one too many: the release
    // workflow already checks the tag against package.json, and this checks
    // package.json against the constant, so a bump cannot half-land.
    expect(prahari.VERSION).toBe(pkg.version);
  });
});
