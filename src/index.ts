/**
 * prahari — type-safe, self-documenting environment variables for TypeScript.
 *
 * Public runtime entry. This module has ZERO runtime dependencies by design —
 * the CLI (jiti, file IO) lives under `./cli` and is never imported here.
 *
 * `defineEnv` is the orchestrator; the `str/num/...` factories declare fields.
 */

export const VERSION = "0.3.0";

export { defineEnv, safeParse } from "./core.js";
export type { DefineEnvOptions, EnvSource, SafeParseResult } from "./core.js";
export { defineSchema, isComposedSchema } from "./schema.js";
export type { ComposedSchema, MergeSchemas, SchemaInput } from "./schema.js";
export {
  str,
  num,
  port,
  bool,
  url,
  oneOf,
  json,
  custom,
  list,
  duration,
  bytes,
} from "./validators.js";
export { standard, isStandardSchema } from "./validators.js";
export type {
  ConditionalRequirement,
  CustomMeta,
  DerivedValidator,
  Validator,
  Infer,
  EnvSchema,
  InferEnv,
  ValidatorMeta,
  EnvField,
  StandardSchemaV1,
  StandardSchemaProps,
  StandardResult,
  StandardIssue,
  StandardMeta,
  InferStandard,
} from "./validators.js";
export { EnvFieldError, EnvValidationError, isEnvFieldError } from "./errors.js";
export type { FieldFailure } from "./errors.js";
