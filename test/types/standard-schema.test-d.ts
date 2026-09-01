import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";
import * as v from "valibot";

import { defineEnv, standard, str, port } from "../../src/index";

/**
 * Layer 3 — Standard Schema fields must infer their OUTPUT type into the env
 * object, both bare and mixed with built-ins, and via the `standard()` wrapper.
 */

describe("Standard Schema inference", () => {
  const env = defineEnv(
    {
      PORT: z.coerce.number(), // bare zod → number
      REGION: z.enum(["us", "eu"]), // bare zod → "us" | "eu"
      COUNT: v.pipe(v.string(), v.transform(Number)), // bare valibot → number
      NAME: str(), // built-in → string
      LEVEL: port().default(3000), // built-in → number
      TOKEN: standard(z.string()), // wrapper → string
    },
    { source: { PORT: "1", REGION: "eu", COUNT: "2", NAME: "x", TOKEN: "t" } },
  );

  it("infers output types from Standard Schema validators", () => {
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.REGION).toEqualTypeOf<"us" | "eu">();
    expectTypeOf(env.COUNT).toEqualTypeOf<number>();
    expectTypeOf(env.TOKEN).toEqualTypeOf<string>();
  });

  it("still infers built-in fields alongside them", () => {
    expectTypeOf(env.NAME).toEqualTypeOf<string>();
    expectTypeOf(env.LEVEL).toEqualTypeOf<number>();
  });
});
