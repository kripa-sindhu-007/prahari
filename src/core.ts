/**
 * `defineEnv` — the orchestrator.
 *
 * Reads each variable from a source record (default `process.env`), coerces it
 * through its validator, collects every failure into one readable report, and
 * either throws `EnvValidationError` (failing the process at boot) or returns a
 * frozen, fully-typed env object.
 *
 * It also registers the schema (see `registry.ts`) so the CLI can introspect it,
 * and honors `ENVGUARD_SKIP_VALIDATION=1` — set by the CLI — to load a config
 * module for its schema WITHOUT running validation or crashing.
 */

import { EnvValidationError, isEnvFieldError, type FieldFailure } from "./errors.js";
import { registerSchema } from "./registry.js";
import { formatReport } from "./report.js";
import type { EnvSchema, InferEnv, Validator } from "./validators.js";

export interface DefineEnvOptions {
  /** Where to read raw values from. Defaults to `process.env`. */
  source?: Record<string, string | undefined>;
}

function skipValidation(): boolean {
  return (
    typeof process !== "undefined" && process.env?.ENVGUARD_SKIP_VALIDATION === "1"
  );
}

function redact(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return raw;
  return "***";
}

export function defineEnv<S extends EnvSchema>(
  schema: S,
  options: DefineEnvOptions = {},
): Readonly<InferEnv<S>> {
  // Always register first so tooling sees the schema even in skip mode.
  registerSchema(schema);

  if (skipValidation()) {
    // Introspection mode: never throw, never read env. Any property access
    // returns undefined so top-level reads in the config module don't crash.
    return new Proxy(
      {},
      { get: () => undefined },
    ) as Readonly<InferEnv<S>>;
  }

  const source =
    options.source ?? (process.env as Record<string, string | undefined>);

  const result: Record<string, unknown> = {};
  const failures: FieldFailure[] = [];

  for (const key of Object.keys(schema)) {
    const validator = schema[key] as Validator<unknown>;
    const raw = source[key];
    try {
      result[key] = validator.parse(raw);
    } catch (err) {
      if (isEnvFieldError(err)) {
        failures.push({
          key,
          reason: err.message,
          received: validator.meta.secret ? redact(raw) : raw,
          expected: validator.meta.typeName,
        });
      } else {
        throw err;
      }
    }
  }

  if (failures.length > 0) {
    throw new EnvValidationError(formatReport(failures), failures);
  }

  return Object.freeze(result) as Readonly<InferEnv<S>>;
}
