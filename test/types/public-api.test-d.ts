import { describe, it, expectTypeOf } from "vitest";

/**
 * #31 — the type half of the API freeze.
 *
 * A runtime test cannot see exported types, so removing or renaming one would
 * sail past `test/public-api.test.ts` and only break in a user's build. This
 * import IS the assertion: if any of these stops being exported, the type test
 * suite fails to compile.
 */
import type {
  // core
  DefineEnvOptions,
  EnvSource,
  EnvWarning,
  SafeParseResult,
  UnknownPolicy,
  // schema composition
  ComposedSchema,
  MergeSchemas,
  SchemaInput,
  // validators
  ConditionalRequirement,
  CustomMeta,
  DerivedValidator,
  EnvField,
  EnvSchema,
  Infer,
  InferEnv,
  Validator,
  ValidatorMeta,
  // Standard Schema bridge
  InferStandard,
  StandardIssue,
  StandardMeta,
  StandardResult,
  StandardSchemaProps,
  StandardSchemaV1,
  // errors
  FieldFailure,
} from "../../src/index";
import type { DefineNextEnvOptions } from "../../src/next/index";
import type { DefineViteEnvOptions } from "../../src/vite/index";
import type { EnvFileValues, LoadEnvFilesOptions } from "../../src/env-file/index";

describe("the frozen type surface", () => {
  it("exports every documented type from the main entry", () => {
    // Referencing each one keeps the import from being elided.
    type All =
      | DefineEnvOptions
      | EnvSource
      | EnvWarning
      | SafeParseResult<EnvSchema>
      | UnknownPolicy
      | ComposedSchema<EnvSchema>
      | MergeSchemas<EnvSchema, EnvSchema>
      | SchemaInput<EnvSchema>
      | ConditionalRequirement
      | CustomMeta
      | DerivedValidator<unknown>
      | EnvField
      | EnvSchema
      | Infer<Validator<string>>
      | InferEnv<EnvSchema>
      | Validator<unknown>
      | ValidatorMeta<unknown>
      | InferStandard<StandardSchemaV1<unknown, string>>
      | StandardIssue
      | StandardMeta
      | StandardResult<unknown>
      | StandardSchemaProps
      | FieldFailure;
    expectTypeOf<All>().not.toBeNever();
  });

  it("exports the adapter and env-file option types", () => {
    type Entries =
      | DefineNextEnvOptions<EnvSchema, EnvSchema>
      | DefineViteEnvOptions<EnvSchema, EnvSchema>
      | LoadEnvFilesOptions
      | EnvFileValues;
    expectTypeOf<Entries>().not.toBeNever();
  });

  it("keeps the shapes the docs promise", () => {
    expectTypeOf<UnknownPolicy>().toEqualTypeOf<"ignore" | "warn" | "error">();
    expectTypeOf<EnvWarning["kind"]>().toEqualTypeOf<"deprecated" | "unknown">();
    expectTypeOf<FieldFailure>().toEqualTypeOf<{
      key: string;
      reason: string;
      received: string | undefined;
      expected: string;
    }>();
  });
});
