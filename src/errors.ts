/**
 * Error types for prahari.
 *
 * - `EnvFieldError` is thrown by a single validator when a raw value fails to
 *   coerce or violates a check. Its message is a *fragment* (e.g. "must be a
 *   number") — the core prefixes it with the variable name when building the
 *   boot-time report.
 * - `EnvValidationError` is the aggregate thrown by `defineEnv` when one or more
 *   variables are missing/invalid (added in P3).
 */

/** Thrown by an individual validator. `message` is a fragment (no key name). */
export class EnvFieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvFieldError";
  }
}

/**
 * Cross-bundle-safe check. The CLI and runtime are separate bundles, so a
 * validator's `EnvFieldError` (from one bundle) fails a plain `instanceof`
 * against the CLI's own class. Fall back to the stable `name` brand.
 */
export function isEnvFieldError(err: unknown): err is EnvFieldError {
  return (
    err instanceof EnvFieldError ||
    (err instanceof Error && err.name === "EnvFieldError")
  );
}

/** A single field's failure, as collected by the core. */
export interface FieldFailure {
  key: string;
  /** The validator's fragment message, e.g. "must be a number". */
  reason: string;
  /** The raw offending value, already redacted if the field is a secret. */
  received: string | undefined;
  /** Human type name of the expected value, e.g. "port". */
  expected: string;
}

/** Aggregate error thrown by `defineEnv` when validation fails. */
export class EnvValidationError extends Error {
  constructor(
    message: string,
    public readonly failures: FieldFailure[],
  ) {
    super(message);
    this.name = "EnvValidationError";
  }
}
