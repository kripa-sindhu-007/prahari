/**
 * `prahari doctor` — validate the CURRENT environment against the schema and
 * print a per-variable red/green table.
 *
 * The validation itself is the core's (`safeParse`); this module only turns the
 * result into what the command prints. That is deliberate: one evaluator means
 * `doctor` cannot disagree with what happens at boot, and it inherits bare
 * Standard Schema support, redaction, conditional requirements and deprecation
 * warnings for free instead of re-implementing each one.
 *
 * Pure functions (unit-testable); the command wrapper prints + sets exit code.
 */

import { safeParse, type EnvWarning } from "../core.js";
import type { FieldFailure } from "../errors.js";
import type { EnvSchema } from "../validators.js";

export interface DoctorResult {
  ok: string[];
  failures: FieldFailure[];
  /** Deprecations (and unknown variables when `strict`) — never fatal. */
  warnings: EnvWarning[];
}

export interface DoctorOptions {
  /**
   * Keys to check against the schema for unknown-variable warnings. The CALLER
   * chooses the set — the CLI passes the `.env` file's own keys, never the whole
   * process environment, which carries hundreds of unrelated variables. Omit to
   * skip the check entirely.
   */
  unknownKeys?: Iterable<string>;
}

/** One variable's line in the machine-readable report. */
export interface DoctorJsonVariable {
  key: string;
  status: "ok" | "invalid";
  reason?: string;
  expected?: string;
  /** Already redacted for `secret()` fields; `null` when the variable is absent. */
  received?: string | null;
}

export interface DoctorJson {
  ok: boolean;
  variables: DoctorJsonVariable[];
  warnings: EnvWarning[];
}

/** Shape the result for `--json`: one entry per variable, in schema order. */
export function renderDoctorJson(schema: EnvSchema, result: DoctorResult): string {
  const failed = new Map(result.failures.map((f) => [f.key, f]));
  const variables: DoctorJsonVariable[] = Object.keys(schema).map((key) => {
    const failure = failed.get(key);
    if (!failure) return { key, status: "ok" };
    return {
      key,
      status: "invalid",
      reason: failure.reason,
      expected: failure.expected,
      // An empty value means UNSET in prahari, and the human report suppresses
      // it — so JSON reports it as null too, rather than making every consumer
      // special-case the empty string.
      received: failure.received === undefined || failure.received === "" ? null : failure.received,
    };
  });
  const payload: DoctorJson = {
    ok: result.failures.length === 0,
    variables,
    warnings: result.warnings,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function runDoctor(
  schema: EnvSchema,
  source: Record<string, string | undefined> = process.env,
  options: DoctorOptions = {},
): DoctorResult {
  // Delegate the actual validation to the core rather than re-implementing it.
  // `safeParse` already handles bare Standard Schema fields, secret redaction,
  // conditional requirements and deprecation warnings — a second implementation
  // here is how `doctor` and a real boot drift apart (and how `doctor` used to
  // crash on a bare Valibot field, which has no `.parse` method of its own).
  const result = safeParse(schema, { source, onWarn: () => {} });
  const failures = result.success ? [] : result.error.failures;
  const failed = new Set(failures.map((f) => f.key));
  const ok = Object.keys(schema).filter((key) => !failed.has(key));
  const warnings = [...result.warnings];

  // Unknown keys are the CLI's own concern: the caller supplies the key set
  // (the env FILE's keys, never the whole process environment). This is a
  // declaration check like `sync`, not a value check, so an empty entry still
  // counts — `STALE=` in a file is exactly the stale leftover worth reporting.
  for (const key of options.unknownKeys ?? []) {
    if (Object.prototype.hasOwnProperty.call(schema, key)) continue;
    warnings.push({
      kind: "unknown",
      key,
      message: `${key} is in the env file but not declared in the schema`,
    });
  }

  return { ok, failures, warnings };
}
