/**
 * `envguard doctor` — validate the CURRENT environment against the schema and
 * print a per-variable red/green table.
 *
 * Pure evaluator (unit-testable); the command wrapper prints + sets exit code.
 */

import { isEnvFieldError, type FieldFailure } from "../errors.js";
import type { EnvSchema, Validator } from "../validators.js";

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

  for (const key of Object.keys(schema)) {
    const validator = schema[key] as Validator<unknown>;
    const raw = source[key];
    try {
      validator.parse(raw);
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

  return { ok, failures };
}
