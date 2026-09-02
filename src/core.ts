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
  deprecationMessage,
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

/** Something worth saying out loud that is not a validation failure. */
export interface EnvWarning {
  kind: "deprecated" | "unknown";
  key: string;
  /** Ready-to-print sentence, already prefixed with the variable name. */
  message: string;
}

/** How to treat source keys the schema does not declare. */
export type UnknownPolicy = "ignore" | "warn" | "error";

export interface DefineEnvOptions {
  /** Where to read raw values from. Defaults to `process.env` (or `{}` without one). */
  source?: EnvSource;
  /**
   * Where warnings go. Defaults to a single `prahari: …` line on `console.warn`
   * (stderr, so structured stdout logging is unaffected). Pass your own logger to
   * redirect, or `() => {}` to silence.
   */
  onWarn?: (warning: EnvWarning) => void;
  /**
   * What to do about variables present in the source but absent from the schema.
   * Defaults to `"ignore"`.
   *
   * Requires an **enumerable** source: a `get(key)` source cannot be listed, so
   * the check is skipped for one. Point this at an explicit record or a loaded
   * `.env` rather than `process.env`, which carries hundreds of unrelated
   * variables (`PATH`, `HOME`, …).
   */
  unknown?: UnknownPolicy;
}

/** The outcome of `safeParse` — a discriminated union, never a throw. */
export type SafeParseResult<S extends EnvSchema> =
  | {
      success: true;
      data: Readonly<InferEnv<S>>;
      error?: undefined;
      warnings: EnvWarning[];
    }
  | {
      success: false;
      data?: undefined;
      error: EnvValidationError;
      warnings: EnvWarning[];
    };

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
): { data: Readonly<InferEnv<S>>; failures: FieldFailure[]; warnings: EnvWarning[] } {
  const source = options.source ?? defaultSource();
  const result: Record<string, unknown> = {};
  const failures: FieldFailure[] = [];
  const warnings: EnvWarning[] = [];

  for (const key of Object.keys(schema)) {
    const field = schema[key];
    const raw = readFrom(source, key);

    // A deprecation is a message to the humans, not a failure — and only worth
    // saying when the variable is actually set.
    const deprecated = isStandardSchema(field)
      ? undefined
      : (field as Validator<unknown>).meta.deprecated;
    if (deprecated && raw !== undefined && raw !== "") {
      warnings.push({
        kind: "deprecated",
        key,
        message: deprecationMessage(key, deprecated.message),
      });
    }

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

  // --- Unknown variables: opt-in, and only for a source we can enumerate. ---
  const policy = options.unknown ?? "ignore";
  if (policy !== "ignore") {
    for (const key of enumerateSource(source)) {
      if (Object.prototype.hasOwnProperty.call(schema, key)) continue;
      // An empty value means UNSET everywhere else in prahari, so `STALE=` is
      // not "set but not declared" — reporting it would contradict the rule the
      // validators use and add noise for placeholder entries.
      const raw = readFrom(source, key);
      if (raw === undefined || raw === "") continue;
      if (policy === "error") {
        failures.push({
          key,
          reason: "is not declared in the schema",
          received: undefined,
          expected: "declared variable",
        });
      } else {
        warnings.push({
          kind: "unknown",
          key,
          message: `${key} is set but not declared in the schema`,
        });
      }
    }
  }

  // Keep the report in schema order even though conditional failures are found
  // in a later pass — the reader is scanning against their own env file.
  if (failures.length > 1) {
    const order = Object.keys(schema);
    const rank = (key: string) => {
      const index = order.indexOf(key);
      // Unknown-variable failures aren't in the schema; keep them after it.
      return index === -1 ? order.length : index;
    };
    failures.sort((a, b) => rank(a.key) - rank(b.key));
  }

  return { data: Object.freeze(result) as Readonly<InferEnv<S>>, failures, warnings };
}

/**
 * List a source's keys, or nothing if it cannot be listed. A `get(key)` source
 * has no key set to walk — unknown-variable detection simply does not apply to
 * it, which is documented rather than silently half-working.
 */
function enumerateSource(source: EnvSource): string[] {
  if (typeof (source as { get?: unknown }).get === "function") return [];
  return Object.keys(source as Record<string, string | undefined>);
}

/** Default warning sink: one greppable line on stderr. */
function defaultWarn(warning: EnvWarning): void {
  console.warn(`prahari: ${warning.message}`);
}

function emit(warnings: EnvWarning[], onWarn: DefineEnvOptions["onWarn"]): void {
  const sink = onWarn ?? defaultWarn;
  for (const warning of warnings) sink(warning);
}

function defineEnvImpl<S extends EnvSchema>(
  schema: SchemaInput<S>,
  options: DefineEnvOptions = {},
): Readonly<InferEnv<S>> {
  const fields = normalizeSchema(schema);
  // Always register first so tooling sees the schema even in skip mode.
  registerSchema(fields);

  if (skipValidation()) return skipProxy<S>();

  const { data, failures, warnings } = run(fields, options);
  emit(warnings, options.onWarn);
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

  if (skipValidation()) return { success: true, data: skipProxy<S>(), warnings: [] };

  const { data, failures, warnings } = run(fields, options);
  emit(warnings, options.onWarn);
  if (failures.length > 0) {
    return {
      success: false,
      error: new EnvValidationError(formatReport(failures), failures),
      warnings,
    };
  }
  return { success: true, data, warnings };
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
