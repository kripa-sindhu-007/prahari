/**
 * `envguard sync` — report drift between the schema and an env file
 * (default `.env.example`).
 *
 * Pure functions (unit-testable); the command wrapper does the file IO + output.
 */

import type { EnvSchema } from "../validators.js";

/** Extract just the declared keys from a dotenv-style file's contents. */
export function parseEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice("export ".length).trim();
    if (key) keys.add(key);
  }
  return keys;
}

export interface Drift {
  /** Declared in the schema but absent from the file. */
  missing: string[];
  /** Present in the file but not declared in the schema. */
  unknown: string[];
}

export function computeDrift(schema: EnvSchema, fileKeys: Set<string>): Drift {
  const schemaKeys = Object.keys(schema);
  const missing = schemaKeys.filter((k) => !fileKeys.has(k));
  const unknown = [...fileKeys].filter((k) => !Object.prototype.hasOwnProperty.call(schema, k));
  return { missing, unknown };
}

export function hasDrift(drift: Drift): boolean {
  return drift.missing.length > 0 || drift.unknown.length > 0;
}
