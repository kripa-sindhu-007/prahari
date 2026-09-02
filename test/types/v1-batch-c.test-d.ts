import { describe, it, expectTypeOf } from "vitest";

import { defineEnv, port, safeParse, str, type EnvWarning } from "../../src/index";

/** Layer 3 — type-level contract for Batch C: warnings and the unknown policy. */

describe("warnings", () => {
  it("types the onWarn callback's argument", () => {
    defineEnv(
      { A: str() },
      {
        source: { A: "x" },
        onWarn: (warning) => {
          expectTypeOf(warning).toEqualTypeOf<EnvWarning>();
          expectTypeOf(warning.kind).toEqualTypeOf<"deprecated" | "unknown">();
          expectTypeOf(warning.key).toEqualTypeOf<string>();
          expectTypeOf(warning.message).toEqualTypeOf<string>();
        },
      },
    );
  });

  it("exposes warnings on both branches of safeParse", () => {
    const result = safeParse({ A: str() }, { source: {} });
    expectTypeOf(result.warnings).toEqualTypeOf<EnvWarning[]>();
    if (result.success) expectTypeOf(result.warnings).toEqualTypeOf<EnvWarning[]>();
    else expectTypeOf(result.warnings).toEqualTypeOf<EnvWarning[]>();
  });

  it("constrains the unknown policy to the three modes", () => {
    defineEnv({ A: str() }, { source: { A: "x" }, unknown: "warn" });
    defineEnv({ A: str() }, { source: { A: "x" }, unknown: "error" });
    defineEnv({ A: str() }, { source: { A: "x" }, unknown: "ignore" });
    // @ts-expect-error — "strict" is not one of the policies
    defineEnv({ A: str() }, { source: { A: "x" }, unknown: "strict" });
  });
});

describe(".deprecated()", () => {
  it("does not change the field's type", () => {
    const env = defineEnv(
      { PORT: port().deprecated("use HTTP_PORT") },
      { source: { PORT: "80" }, onWarn: () => {} },
    );
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
  });

  it("chains with the other metadata modifiers, before .optional()", () => {
    const env = defineEnv(
      { OLD: str().desc("legacy").secret().deprecated().optional() },
      { source: {}, onWarn: () => {} },
    );
    expectTypeOf(env.OLD).toEqualTypeOf<string | undefined>();

    // .optional() returns the plain Validator interface, so metadata modifiers
    // come BEFORE it — the same ordering rule as .transform().
    // @ts-expect-error — .deprecated() is not available after .optional()
    str().optional().deprecated();
  });
});
