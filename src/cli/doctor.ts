/**
 * `prahari doctor` — validate the CURRENT environment against the schema and
 * print a per-variable red/green table.
 *
 * Pure evaluator (unit-testable); the command wrapper prints + sets exit code.
 */

import type { EnvWarning } from "../core.js";
import { isEnvFieldError, type FieldFailure } from "../errors.js";
import {
  conditionalFailure,
  deprecationMessage,
  type EnvSchema,
  type Validator,
} from "../validators.js";

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
      received: failure.received ?? null,
    };
  });
  const payload: DoctorJson = {
    ok: result.failures.length === 0,
    variables,
    warnings: result.warnings,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function redact(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return raw;
  return "***";
}

export function runDoctor(
  schema: EnvSchema,
  source: Record<string, string | undefined> = process.env,
  options: DoctorOptions = {},
): DoctorResult {
  const ok: string[] = [];
  const failures: FieldFailure[] = [];
  const warnings: EnvWarning[] = [];
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(schema)) {
    const validator = schema[key] as Validator<unknown>;
    const raw = source[key];
    const deprecated = validator.meta?.deprecated;
    if (deprecated && raw !== undefined && raw !== "") {
      warnings.push({
        kind: "deprecated",
        key,
        message: deprecationMessage(key, deprecated.message),
      });
    }
    try {
      resolved[key] = validator.parse(raw);
      ok.push(key);
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

  // Conditional requirements can only be judged once everything else resolved —
  // same second pass as `defineEnv`, via the same shared helper, so `doctor` and
  // a real boot can never disagree.
  for (const key of Object.keys(schema)) {
    if (resolved[key] !== undefined) continue;
    if (failures.some((f) => f.key === key)) continue;
    const failure = conditionalFailure(key, schema[key]!, resolved);
    if (!failure) continue;
    failures.push(failure);
    const index = ok.indexOf(key);
    if (index !== -1) ok.splice(index, 1);
  }

  for (const key of options.unknownKeys ?? []) {
    if (Object.prototype.hasOwnProperty.call(schema, key)) continue;
    warnings.push({
      kind: "unknown",
      key,
      message: `${key} is set but not declared in the schema`,
    });
  }

  if (failures.length > 1) {
    const order = Object.keys(schema);
    failures.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }

  return { ok, failures, warnings };
}
