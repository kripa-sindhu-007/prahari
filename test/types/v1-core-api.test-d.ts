import { describe, it, expectTypeOf } from "vitest";

import {
  custom,
  defineEnv,
  defineSchema,
  num,
  oneOf,
  port,
  safeParse,
  str,
  type EnvSource,
} from "../../src/index";

/**
 * Layer 3 — type-level contract for the v1 core API: composed schemas, custom /
 * transform, and the safeParse discriminated union.
 */

describe("composed schema inference", () => {
  const base = defineSchema({
    LOG_LEVEL: oneOf(["debug", "info"]).default("info"),
    SERVICE_NAME: str(),
  });

  it("infers the base fields", () => {
    const env = defineEnv(base, { source: {} });
    expectTypeOf(env.LOG_LEVEL).toEqualTypeOf<"debug" | "info">();
    expectTypeOf(env.SERVICE_NAME).toEqualTypeOf<string>();
  });

  it("infers base ∪ extension", () => {
    const env = defineEnv(base.extend({ PORT: port() }), { source: {} });
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.SERVICE_NAME).toEqualTypeOf<string>();
  });

  it("gives an overriding key the OVERRIDING type, not a union", () => {
    const env = defineEnv(base.extend({ SERVICE_NAME: num() }), { source: {} });
    expectTypeOf(env.SERVICE_NAME).toEqualTypeOf<number>();
  });

  it("infers through chained extends and merge", () => {
    const env = defineEnv(
      base.extend({ PORT: port() }).merge(defineSchema({ DEBUG: str().optional() })),
      { source: {} },
    );
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.DEBUG).toEqualTypeOf<string | undefined>();
  });

  it("rejects a non-field value in a composed schema", () => {
    // @ts-expect-error — 42 is not a validator
    defineSchema({ NOPE: 42 });
  });
});

describe("custom() and .transform() inference", () => {
  it("infers the custom function's return type", () => {
    const env = defineEnv(
      { TENANTS: custom((raw) => raw.split(",")) },
      { source: { TENANTS: "a" } },
    );
    expectTypeOf(env.TENANTS).toEqualTypeOf<string[]>();
  });

  it("types the raw input of a custom function as string", () => {
    custom((raw) => {
      expectTypeOf(raw).toEqualTypeOf<string>();
      return raw;
    });
  });

  it("re-types a field through .transform()", () => {
    const env = defineEnv(
      {
        TAGS: str().transform((s) => s.split(",")),
        SIZE: num().transform((n) => ({ bytes: n })),
      },
      { source: { TAGS: "a", SIZE: "1" } },
    );
    expectTypeOf(env.TAGS).toEqualTypeOf<string[]>();
    expectTypeOf(env.SIZE).toEqualTypeOf<{ bytes: number }>();
  });

  it("types the transform's input as the pre-transform type", () => {
    num().transform((n) => {
      expectTypeOf(n).toEqualTypeOf<number>();
      return n;
    });
  });

  it("types .default() after .transform() at the transformed type", () => {
    // @ts-expect-error — the default must be the TRANSFORMED type (string[])
    str().transform((s) => s.split(",")).default("not-an-array");

    const env = defineEnv(
      { TAGS: str().transform((s) => s.split(",")).default([]) },
      { source: {} },
    );
    expectTypeOf(env.TAGS).toEqualTypeOf<string[]>();
  });

  it("widens with .optional() after .transform()", () => {
    const env = defineEnv(
      { N: str().transform((s) => s.length).optional() },
      { source: {} },
    );
    expectTypeOf(env.N).toEqualTypeOf<number | undefined>();
  });
});

describe("safeParse inference", () => {
  const schema = { PORT: port(), NAME: str().optional() };

  it("narrows to typed data on success", () => {
    const result = safeParse(schema, { source: {} });
    if (result.success) {
      expectTypeOf(result.data.PORT).toEqualTypeOf<number>();
      expectTypeOf(result.data.NAME).toEqualTypeOf<string | undefined>();
    }
  });

  it("narrows to the aggregate error on failure", () => {
    const result = safeParse(schema, { source: {} });
    if (!result.success) {
      expectTypeOf(result.error.failures).toEqualTypeOf<
        import("../../src/errors").FieldFailure[]
      >();
      expectTypeOf(result.data).toEqualTypeOf<undefined>();
    }
  });

  it("matches defineEnv's inference exactly", () => {
    const thrown = defineEnv(schema, { source: {} });
    const result = safeParse(schema, { source: {} });
    if (result.success) {
      expectTypeOf(result.data).toEqualTypeOf<typeof thrown>();
    }
  });

  it("is reachable as defineEnv.safeParse", () => {
    const result = defineEnv.safeParse(schema, { source: {} });
    if (result.success) expectTypeOf(result.data.PORT).toEqualTypeOf<number>();
  });
});

describe("EnvSource", () => {
  it("accepts a plain record and a getter", () => {
    // The annotations themselves are the assignability assertions — a form
    // that fails compilation (and so the type test) if either shape stops
    // satisfying `EnvSource`.
    const record: EnvSource = {} as Record<string, string | undefined>;
    const getter: EnvSource = { get: (key: string) => key };
    void record;
    void getter;
    // @ts-expect-error — an async source is not (yet) an EnvSource
    const asyncSource: EnvSource = { get: async () => "x" };
    void asyncSource;
  });

  it("rejects a source whose values are not strings", () => {
    // @ts-expect-error — values must be `string | undefined`
    defineEnv({ A: str() }, { source: { A: 42 } });
  });
});
