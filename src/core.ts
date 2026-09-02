/**
 * `defineEnv` — the orchestrator.
 *
 * Reads each variable from a source (default `process.env`), coerces it through
 * its validator, collects every failure into one readable report, and either
 * throws `EnvValidationError` (failing the process at boot) or returns a frozen,
 * fully-typed env object. `defineEnv.safeParse` runs the identical pipeline and
 * returns the outcome instead of throwing.
 *
 * It also registers the schema (see `registry.ts`) so the CLI can introspect it,
 * and honors `PRAHARI_SKIP_VALIDATION=1` — set by the CLI — to load a config
 * module for its schema WITHOUT running validation or crashing.
 */

import { EnvValidationError, isEnvFieldError, type FieldFailure } from "./errors.js";
import { registerSchema } from "./registry.js";
import { formatReport } from "./report.js";
import { normalizeSchema, type SchemaInput } from "./schema.js";
import {
  ASYNC_STANDARD_MESSAGE,
  conditionalFailure,
  formatStandardIssues,
  isPromiseLike,
  isStandardSchema,
  NO_RESULT_STANDARD_MESSAGE,
  type EnvSchema,
  type InferEnv,
  type StandardResult,
  type Validator,
} from "./validators.js";

/**
 * Where raw values come from — the extension point for runtimes that have no
 * `process.env` (Cloudflare Workers, Deno Deploy), for tests, and for future
 * secret-manager adapters.
 *
 * Either a plain record, or anything with a synchronous `get(key)`. prahari only
 * ever asks for keys the schema declares, so a source never has to enumerate.
 *
 * Resolution is synchronous by design: `defineEnv` runs at module scope so the
 * process fails at boot, before any handler runs. An async source (fetching from
 * Vault/Doppler/AWS Secrets Manager) would force the whole entry point to become
 * a promise — that is a separate API, deliberately deferred past 1.0.
 */
export type EnvSource =
  | Record<string, string | undefined>
  | { get(key: string): string | undefined };

export interface DefineEnvOptions {
  /** Where to read raw values from. Defaults to `process.env` (or `{}` without one). */
  source?: EnvSource;
}

/** The outcome of `safeParse` — a discriminated union, never a throw. */
export type SafeParseResult<S extends EnvSchema> =
  | { success: true; data: Readonly<InferEnv<S>>; error?: undefined }
  | { success: false; data?: undefined; error: EnvValidationError };

function skipValidation(): boolean {
  return (
    typeof process !== "undefined" && process.env?.PRAHARI_SKIP_VALIDATION === "1"
  );
}

/**
 * `process` does not exist on edge runtimes, so referencing `process.env`
 * unguarded would throw a ReferenceError there — exactly where a caller is most
 * likely to be relying on an explicit `source`. Absent everything, an empty
 * source yields the normal "is required but was not set" report.
 */
function defaultSource(): EnvSource {
  return typeof process !== "undefined" && process.env ? process.env : {};
}

/** Read one key from either source form. */
function readFrom(source: EnvSource, key: string): string | undefined {
  const get = (source as { get?: unknown }).get;
  if (typeof get === "function") {
    return (source as { get(key: string): string | undefined }).get(key);
  }
  return (source as Record<string, string | undefined>)[key];
}

function redact(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return raw;
  return "***";
}

/** Introspection stand-in: every property read is `undefined`, nothing throws. */
function skipProxy<S extends EnvSchema>(): Readonly<InferEnv<S>> {
  return new Proxy({}, { get: () => undefined }) as Readonly<InferEnv<S>>;
}

/**
 * The single validation pipeline. `defineEnv` throws on failures, `safeParse`
 * returns them — so the two can never drift apart.
 */
function run<S extends EnvSchema>(
  schema: S,
  options: DefineEnvOptions,
): { data: Readonly<InferEnv<S>>; failures: FieldFailure[] } {
  const source = options.source ?? defaultSource();
  const result: Record<string, unknown> = {};
  const failures: FieldFailure[] = [];

  for (const key of Object.keys(schema)) {
    const field = schema[key];
    const raw = readFrom(source, key);

    // Bare Standard Schema (Zod / Valibot / ArkType) — no prahari metadata, so
    // run its own `validate` and map any issues into the same aggregate report.
    // Wrapped schemas (`standard(...)`) are plain Validators and take the path
    // below. Every outcome is COLLECTED (never thrown mid-loop) so a single
    // report still lists every failing variable.
    if (isStandardSchema(field)) {
      const props = field["~standard"];
      const outcome = props.validate(raw);
      // An async schema / malformed result is a developer error, not a config
      // one; surface it in the report with no `received` (never leak a value).
      if (isPromiseLike(outcome)) {
        failures.push({ key, reason: ASYNC_STANDARD_MESSAGE, received: undefined, expected: props.vendor });
        continue;
      }
      if (!outcome) {
        failures.push({ key, reason: NO_RESULT_STANDARD_MESSAGE, received: undefined, expected: props.vendor });
        continue;
      }
      const sync = outcome as StandardResult<unknown>;
      if (sync.issues) {
        // Bare Standard Schemas carry no `secret` marker — wrap with `standard()`
        // to redact. See docs for the reasoning.
        failures.push({
          key,
          reason: formatStandardIssues(sync.issues),
          received: raw,
          expected: props.vendor,
        });
      } else {
        result[key] = sync.value;
      }
      continue;
    }

    const validator = field as Validator<unknown>;
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

  // --- Second pass: conditional requirements (`.requiredWhen` / `.requiredIn`).
  //     These are the only rules that depend on OTHER variables, so they can
  //     only be judged once the rest of the environment has resolved. A schema
  //     with no conditional field never enters this loop. ---
  for (const key of Object.keys(schema)) {
    // Present, or already reported — nothing conditional left to decide.
    if (result[key] !== undefined) continue;
    if (failures.some((f) => f.key === key)) continue;
    const failure = conditionalFailure(key, schema[key]!, result);
    if (failure) failures.push(failure);
  }

  // Keep the report in schema order even though conditional failures are found
  // in a later pass — the reader is scanning against their own env file.
  if (failures.length > 1) {
    const order = Object.keys(schema);
    failures.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }

  return { data: Object.freeze(result) as Readonly<InferEnv<S>>, failures };
}

function defineEnvImpl<S extends EnvSchema>(
  schema: SchemaInput<S>,
  options: DefineEnvOptions = {},
): Readonly<InferEnv<S>> {
  const fields = normalizeSchema(schema);
  // Always register first so tooling sees the schema even in skip mode.
  registerSchema(fields);

  if (skipValidation()) return skipProxy<S>();

  const { data, failures } = run(fields, options);
  if (failures.length > 0) {
    throw new EnvValidationError(formatReport(failures), failures);
  }
  return data;
}

/**
 * Validate an environment without throwing — for tests, health checks and
 * tooling that wants to report rather than crash. Same pipeline as `defineEnv`;
 * a genuine bug inside a validator still propagates, because that is not a
 * configuration failure.
 */
export function safeParse<S extends EnvSchema>(
  schema: SchemaInput<S>,
  options: DefineEnvOptions = {},
): SafeParseResult<S> {
  const fields = normalizeSchema(schema);
  registerSchema(fields);

  if (skipValidation()) return { success: true, data: skipProxy<S>() };

  const { data, failures } = run(fields, options);
  if (failures.length > 0) {
    return { success: false, error: new EnvValidationError(formatReport(failures), failures) };
  }
  return { success: true, data };
}

interface DefineEnv {
  <S extends EnvSchema>(
    schema: SchemaInput<S>,
    options?: DefineEnvOptions,
  ): Readonly<InferEnv<S>>;
  /** Non-throwing variant — see `safeParse`. */
  safeParse: typeof safeParse;
}

/**
 * Validate the environment and return a frozen, fully-typed object. Throws
 * `EnvValidationError` listing every failure at once.
 */
export const defineEnv: DefineEnv = Object.assign(defineEnvImpl, { safeParse });
