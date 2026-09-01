import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";

import { defineNextEnv } from "../../src/next/index";
import { str, url, port } from "../../src/index";

/**
 * Layer 3 — the Next adapter must merge server + client into one typed object,
 * inferring built-ins and Standard Schema fields alike.
 */

describe("defineNextEnv inference", () => {
  const env = defineNextEnv({
    server: { DATABASE_URL: str(), PORT: port(), MAX: z.coerce.number() },
    client: { NEXT_PUBLIC_API_URL: url(), NEXT_PUBLIC_REGION: z.enum(["us", "eu"]) },
    runtimeEnv: {},
    isServer: true,
  });

  it("types server fields (built-in + Standard Schema)", () => {
    expectTypeOf(env.DATABASE_URL).toEqualTypeOf<string>();
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.MAX).toEqualTypeOf<number>();
  });

  it("types client fields alongside them", () => {
    expectTypeOf(env.NEXT_PUBLIC_API_URL).toEqualTypeOf<string>();
    expectTypeOf(env.NEXT_PUBLIC_REGION).toEqualTypeOf<"us" | "eu">();
  });

  it("rejects unknown keys", () => {
    // @ts-expect-error — NOPE is not in the schema
    env.NOPE;
  });
});
