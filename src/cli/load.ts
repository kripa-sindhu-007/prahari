/**
 * Loads a user's env config module and returns the schema it declared —
 * WITHOUT running validation.
 *
 * The trick: set `ENVGUARD_SKIP_VALIDATION=1` before importing, so `defineEnv`
 * registers its schema (into the globalThis registry) and returns a harmless
 * proxy instead of validating/throwing. We then read the registry back. `jiti`
 * lets us import a TypeScript config at runtime with no build step.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createJiti } from "jiti";

import { clearRegistry, getRegisteredSchema } from "../registry.js";
import type { EnvSchema } from "../validators.js";

const CANDIDATES = [
  "env.ts",
  "env.mts",
  "env.js",
  "env.mjs",
  "src/env.ts",
  "src/env.mts",
  "src/env.js",
  "src/env.mjs",
];

/** Resolve the config file path (explicit `--config`, else conventional names). */
export function resolveConfigPath(
  explicit?: string,
  cwd: string = process.cwd(),
): string | null {
  if (explicit) {
    const p = resolve(cwd, explicit);
    return existsSync(p) ? p : null;
  }
  for (const candidate of CANDIDATES) {
    const p = resolve(cwd, candidate);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Import the config for its schema only (no validation). */
export async function loadSchema(configPath: string): Promise<EnvSchema> {
  process.env.ENVGUARD_SKIP_VALIDATION = "1";
  clearRegistry();
  // moduleCache:false so re-loading the same config path re-runs defineEnv
  // (otherwise a second load after clearRegistry() would see an empty schema).
  const jiti = createJiti(pathToFileURL(configPath).href, { moduleCache: false });
  await jiti.import(configPath);
  return getRegisteredSchema();
}

export const CONFIG_CANDIDATES = CANDIDATES;
