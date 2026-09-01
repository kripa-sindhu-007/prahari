import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";

import { defineViteEnv } from "../../src/vite/index";
import { str, url, port } from "../../src/index";

/**
 * Layer 3 — the Vite adapter must merge server + client into one typed object,
 * inferring built-ins and Standard Schema fields alike.
 */

describe("defineViteEnv inference", () => {
  const env = defineViteEnv({
    server: { DATABASE_URL: str(), PORT: port() },
    client: { VITE_API_URL: url(), VITE_REGION: z.enum(["us", "eu"]) },
    runtimeEnv: {},
    isServer: true,
  });

  it("types server and client fields (built-in + Standard Schema)", () => {
    expectTypeOf(env.DATABASE_URL).toEqualTypeOf<string>();
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.VITE_API_URL).toEqualTypeOf<string>();
    expectTypeOf(env.VITE_REGION).toEqualTypeOf<"us" | "eu">();
  });

  it("rejects unknown keys", () => {
    // @ts-expect-error — NOPE is not in the schema
    env.NOPE;
  });
});
