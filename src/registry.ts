/**
 * Schema registry — how the CLI discovers what `defineEnv` declared.
 *
 * The runtime entry (`dist/index.js`) and the CLI (`dist/cli.js`) are SEPARATE
 * bundles, so a plain module-level singleton would give each its own copy. We
 * store the registry on `globalThis` under a global-registry Symbol so both
 * bundles (and the user's jiti-loaded config) read and write the exact same
 * object.
 */

import type { EnvSchema } from "./validators.js";

const KEY = Symbol.for("prahari.registry.v1");

interface RegistryStore {
  schemas: EnvSchema[];
}

function store(): RegistryStore {
  const g = globalThis as unknown as Record<symbol, RegistryStore | undefined>;
  let s = g[KEY];
  if (!s) {
    s = { schemas: [] };
    g[KEY] = s;
  }
  return s;
}

/** Called by `defineEnv` for every schema it sees. */
export function registerSchema(schema: EnvSchema): void {
  store().schemas.push(schema);
}

/** All schemas registered so far, in order. */
export function getRegisteredSchemas(): EnvSchema[] {
  return store().schemas.slice();
}

/** A single merged schema across all registrations (last write wins per key). */
export function getRegisteredSchema(): EnvSchema {
  return Object.assign({}, ...store().schemas) as EnvSchema;
}

/** Reset — used by tests and by the CLI between config loads. */
export function clearRegistry(): void {
  store().schemas.length = 0;
}
