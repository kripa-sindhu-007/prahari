import { describe, it, expectTypeOf } from "vitest";

import { defineEnv, str, port, bool, oneOf } from "../../src/index";

/**
 * Layer 3 — `defineEnv` end-to-end inference: the returned object must be typed
 * from the schema, with `.optional()` widening and readonly-ness preserved.
 */

describe("defineEnv inference", () => {
  const env = defineEnv(
    {
      NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
      PORT: port().default(3000),
      DEBUG: bool().default(false),
      NAME: str().optional(),
    },
    { source: { NODE_ENV: "test", PORT: "1", DEBUG: "true" } },
  );

  it("infers each field's type from its validator", () => {
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.DEBUG).toEqualTypeOf<boolean>();
    expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "production" | "test">();
    expectTypeOf(env.NAME).toEqualTypeOf<string | undefined>();
  });

  it("returns a readonly object", () => {
    // @ts-expect-error — the returned env is frozen/readonly
    env.PORT = 1;
  });

  it("does not permit assigning a field to the wrong type", () => {
    // @ts-expect-error — PORT is a number, not a string
    const s: string = env.PORT;
    void s;
  });
});
