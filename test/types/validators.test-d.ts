import { describe, it, expectTypeOf } from "vitest";

import { str, num, port, bool, url, oneOf, json } from "../../src/index";

/**
 * Layer 3 — type-level. The inference IS the product; these assertions fail the
 * build if a refactor breaks output types, even when runtime tests stay green.
 */

describe("validator output types", () => {
  it("primitive validators infer their scalar type", () => {
    expectTypeOf(str().parse("x")).toEqualTypeOf<string>();
    expectTypeOf(num().parse("1")).toEqualTypeOf<number>();
    expectTypeOf(port().parse("1")).toEqualTypeOf<number>();
    expectTypeOf(bool().parse("true")).toEqualTypeOf<boolean>();
    expectTypeOf(url().parse("https://x")).toEqualTypeOf<string>();
  });

  it("oneOf narrows to the literal union", () => {
    expectTypeOf(oneOf(["development", "production", "test"]).parse("test")).toEqualTypeOf<
      "development" | "production" | "test"
    >();
  });

  it("json is generic over its payload", () => {
    expectTypeOf(json<number[]>().parse("[]")).toEqualTypeOf<number[]>();
    expectTypeOf(json().parse("{}")).toEqualTypeOf<unknown>();
  });

  it(".optional() widens the output to include undefined", () => {
    expectTypeOf(str().optional().parse(undefined)).toEqualTypeOf<string | undefined>();
    expectTypeOf(port().optional().parse(undefined)).toEqualTypeOf<number | undefined>();
  });

  it("rejects values outside a oneOf union", () => {
    const v = oneOf(["a", "b"]).parse("a");
    // @ts-expect-error — "c" is not part of the union
    const bad: typeof v = "c";
    void bad;
  });
});
