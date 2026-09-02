import { describe, it, expect, beforeEach } from "vitest";

import { defineEnv, EnvValidationError, list, num, port, str } from "../src/index";
import { describeField } from "../src/validators";
import { clearRegistry } from "../src/registry";

/** #23 — `list()`: a delimited env value into a typed array. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

const parse = <T>(field: { parse(raw: string | undefined): T }, raw: string | undefined) =>
  field.parse(raw);

describe("list()", () => {
  it("splits on commas into a string array", () => {
    const env = defineEnv({ ORIGINS: list() }, { source: { ORIGINS: "a,b,c" } });
    expect(env.ORIGINS).toEqual(["a", "b", "c"]);
  });

  it("trims items and drops empty ones", () => {
    expect(parse(list(), " a , b ,, c ,")).toEqual(["a", "b", "c"]);
  });

  it("keeps a single item as a one-element array", () => {
    expect(parse(list(), "solo")).toEqual(["solo"]);
  });

  it("treats an empty variable as UNSET, not as an empty list", () => {
    // The library-wide empty-string rule: FOO= flows through default/optional/required.
    expect(() => defineEnv({ TAGS: list() }, { source: { TAGS: "" } })).toThrow(
      /is required but was not set/,
    );
    const withDefault = defineEnv({ TAGS: list().default([]) }, { source: { TAGS: "" } });
    expect(withDefault.TAGS).toEqual([]);
    const optional = defineEnv({ TAGS: list().optional() }, { source: {} });
    expect(optional.TAGS).toBeUndefined();
  });

  it("supports a custom separator", () => {
    expect(parse(list().separator(";"), "a;b;c")).toEqual(["a", "b", "c"]);
    expect(parse(list().separator(" "), "a b  c")).toEqual(["a", "b", "c"]);
  });

  it("rejects an empty separator at declaration", () => {
    expect(() => list().separator("")).toThrow(/separator\(\) cannot be empty/);
  });
});

describe("list().of()", () => {
  it("validates and types each item", () => {
    const env = defineEnv({ PORTS: list().of(port()) }, { source: { PORTS: "80,443" } });
    expect(env.PORTS).toEqual([80, 443]);
    const typed: number[] = env.PORTS;
    expect(typed).toHaveLength(2);
  });

  it("reports EVERY bad element, with its index and value", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ PORTS: list().of(num().int()) }, { source: { PORTS: "80,abc,1.5" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures).toHaveLength(1); // one variable...
    expect(error?.failures[0]?.reason).toBe(
      'item 2 ("abc") must be a number; item 3 ("1.5") must be an integer',
    ); // ...listing both bad items
  });

  it("applies the inner validator's own rules", () => {
    expect(() => parse(list().of(port()), "80,99999")).toThrow(/item 2 \("99999"\) must be <= 65535/);
  });

  it("carries the separator, description and secret across .of()", () => {
    const field = list().separator(";").desc("Allowed ports").secret().of(port());
    expect(field.parse("80;443")).toEqual([80, 443]);
    const d = describeField(field);
    expect(d.description).toBe("Allowed ports");
    expect(d.secret).toBe(true);
  });

  it("refuses .of() after a modifier that would be typed wrong", () => {
    expect(() => list().default(["a"]).of(port())).toThrow(/call \.of\(\) before/);
    expect(() => list().min(1).of(port())).toThrow(/call \.of\(\) before/);
  });
});

describe("list() length checks", () => {
  it("enforces min and max item counts", () => {
    expect(() => parse(list().min(2), "a")).toThrow(/must have at least 2 item\(s\)/);
    expect(() => parse(list().max(2), "a,b,c")).toThrow(/must have at most 2 item\(s\)/);
    expect(parse(list().min(1).max(3), "a,b")).toEqual(["a", "b"]);
  });
});

describe("list() rendering", () => {
  it("renders a sensible .env.example placeholder", () => {
    expect(describeField(list()).exampleValue()).toBe("a,b,c");
    expect(describeField(list().separator(";")).exampleValue()).toBe("a;b;c");
    expect(describeField(list().of(port())).exampleValue()).toBe("3000");
  });

  it("renders a default in the RAW delimited form, so .env.example round-trips", () => {
    // `TAGS=["x","y"]` would read back as ONE item — the generated file must be
    // something you can actually paste into a .env.
    expect(describeField(list().default(["x", "y"])).exampleValue()).toBe("x,y");
    expect(describeField(list().separator(";").default(["x", "y"])).exampleValue()).toBe("x;y");
    expect(describeField(list().of(port()).default([80, 443])).exampleValue()).toBe("80,443");
    expect(describeField(list().default([])).exampleValue()).toBe("");
  });

  it("reports the list type name", () => {
    expect(describeField(list()).typeName).toBe("list");
  });
});

describe("list() composes with the rest of the API", () => {
  it("works with .transform()", () => {
    const env = defineEnv(
      { TAGS: list().transform((items) => new Set(items)) },
      { source: { TAGS: "a,b,a" } },
    );
    expect(env.TAGS).toEqual(new Set(["a", "b"]));
  });

  it("works inside a composed schema", () => {
    const env = defineEnv(
      { NAME: str(), ORIGINS: list().default([]) },
      { source: { NAME: "svc" } },
    );
    expect(env.ORIGINS).toEqual([]);
  });
});

describe("list() error propagation", () => {
  it("rethrows a non-EnvFieldError from an item validator (a real bug)", () => {
    const exploding = {
      typeName: "boom",
      meta: { typeName: "boom", secret: false, optional: false, hasDefault: false },
      parse() {
        throw new TypeError("validator bug");
      },
      exampleValue: () => "",
    };
    expect(() => list().of(exploding).parse("a,b")).toThrow(TypeError);
  });
});
