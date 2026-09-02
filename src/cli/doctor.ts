/**
 * `prahari doctor` — validate the CURRENT environment against the schema and
 * print a per-variable red/green table.
 *
 * Pure evaluator (unit-testable); the command wrapper prints + sets exit code.
 */

import { isEnvFieldError, type FieldFailure } from "../errors.js";
import { conditionalFailure, type EnvSchema, type Validator } from "../validators.js";

export interface DoctorResult {
  ok: string[];
  failures: FieldFailure[];
}

function redact(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return raw;
  return "***";
}

export function runDoctor(
  schema: EnvSchema,
  source: Record<string, string | undefined> = process.env,
): DoctorResult {
  const ok: string[] = [];
  const failures: FieldFailure[] = [];
  const resolved: Record<string, unknown> = {};

  for (const key of Object.keys(schema)) {
    const validator = schema[key] as Validator<unknown>;
    const raw = source[key];
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

  if (failures.length > 1) {
    const order = Object.keys(schema);
    failures.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }

  return { ok, failures };
}
