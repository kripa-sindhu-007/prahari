import { describe, it, expect } from "vitest";

import { str, num, port, bool, url, oneOf, json, EnvFieldError } from "../src/index";

/**
 * The coercion matrix — the frozen contract for turning raw env strings into
 * typed values. This is the highest bug-surface area of the library, so it is
 * written first and exhaustively.
 */

describe("absent semantics (undefined and '' are both 'unset')", () => {
  it("treats undefined as absent", () => {
    expect(() => str().parse(undefined)).toThrow(EnvFieldError);
  });

  it("treats empty string as absent", () => {
    expect(() => str().parse("")).toThrow(EnvFieldError);
  });

  it("returns the (typed) default when absent", () => {
    expect(port().default(3000).parse(undefined)).toBe(3000);
    expect(str().default("hi").parse("")).toBe("hi");
  });

  it("returns undefined when optional and absent", () => {
    expect(str().optional().parse(undefined)).toBeUndefined();
    expect(num().optional().parse("")).toBeUndefined();
  });

  it("throws a 'required' error when absent, no default, not optional", () => {
    expect(() => num().parse(undefined)).toThrow(/required/);
  });

  it("keeps defaults typed, not re-parsed from strings", () => {
    const v = port().default(3000).parse(undefined);
    expect(typeof v).toBe("number");
  });
});

describe("str", () => {
  it("returns the raw value verbatim (no trim)", () => {
    expect(str().parse("  hello  ")).toBe("  hello  ");
  });
  it("min / max length", () => {
    expect(() => str().min(3).parse("ab")).toThrow(/at least 3/);
    expect(() => str().max(2).parse("abc")).toThrow(/at most 2/);
    expect(str().min(1).max(5).parse("abc")).toBe("abc");
  });
  it("startsWith", () => {
    expect(str().startsWith("sk_").parse("sk_live_1")).toBe("sk_live_1");
    expect(() => str().startsWith("sk_").parse("pk_live_1")).toThrow(/start with/);
  });
  it("matches", () => {
    expect(str().matches(/^\d+$/).parse("123")).toBe("123");
    expect(() => str().matches(/^\d+$/).parse("12a")).toThrow(/must match/);
  });
});

describe("num", () => {
  it("parses integers and decimals", () => {
    expect(num().parse("42")).toBe(42);
    expect(num().parse("3.14")).toBe(3.14);
    expect(num().parse("-7")).toBe(-7);
  });
  it("trims surrounding whitespace", () => {
    expect(num().parse("  10  ")).toBe(10);
  });
  it("accepts exponent notation", () => {
    expect(num().parse("1e3")).toBe(1000);
  });
  it("rejects non-numeric and whitespace-only", () => {
    expect(() => num().parse("abc")).toThrow(/must be a number/);
    expect(() => num().parse("12abc")).toThrow(/must be a number/);
    expect(() => num().parse("   ")).toThrow(/must be a number/);
  });
  it("int / min / max", () => {
    expect(() => num().int().parse("1.5")).toThrow(/integer/);
    expect(() => num().min(10).parse("9")).toThrow(/>= 10/);
    expect(() => num().max(10).parse("11")).toThrow(/<= 10/);
  });
});

describe("port", () => {
  it("accepts a valid port", () => {
    expect(port().parse("8080")).toBe(8080);
  });
  it("rejects out-of-range and non-integer ports", () => {
    expect(() => port().parse("0")).toThrow(/>= 1/);
    expect(() => port().parse("70000")).toThrow(/<= 65535/);
    expect(() => port().parse("80.5")).toThrow(/integer/);
    expect(() => port().parse("-1")).toThrow(/>= 1/);
  });
});

describe("bool", () => {
  const truthy = ["1", "true", "yes", "on", "TRUE", "Yes", " on "];
  const falsey = ["0", "false", "no", "off", "FALSE", "No", " off "];

  it.each(truthy)("coerces %j to true", (raw) => {
    expect(bool().parse(raw)).toBe(true);
  });
  it.each(falsey)("coerces %j to false", (raw) => {
    expect(bool().parse(raw)).toBe(false);
  });
  it("rejects non-boolean strings (the classic footgun)", () => {
    expect(() => bool().parse("maybe")).toThrow(/must be a boolean/);
    // The whole point: a truthy-looking string must NOT silently pass.
    expect(() => bool().parse("False!")).toThrow(/must be a boolean/);
  });
  it("a value of 'false' is false, not a truthy string", () => {
    expect(bool().parse("false")).toBe(false);
  });
});

describe("url", () => {
  it("accepts valid URLs and trims", () => {
    expect(url().parse("https://example.com")).toBe("https://example.com");
    expect(url().parse("  https://example.com/x  ")).toBe("https://example.com/x");
  });
  it("rejects invalid URLs", () => {
    expect(() => url().parse("not a url")).toThrow(/valid URL/);
  });
  it("enforces protocol", () => {
    expect(url().protocol("https").parse("https://x.com")).toBe("https://x.com");
    expect(() => url().protocol("https").parse("http://x.com")).toThrow(/https: protocol/);
  });
});

describe("oneOf", () => {
  it("accepts allowed values and narrows the type", () => {
    const v = oneOf(["development", "production", "test"]);
    const parsed = v.parse("production");
    expect(parsed).toBe("production");
    // @ts-expect-error — "staging" is not part of the union
    const _bad: typeof parsed = "staging";
    void _bad;
  });
  it("rejects disallowed values", () => {
    expect(() => oneOf(["a", "b"]).parse("c")).toThrow(/must be one of a, b/);
  });
});

describe("json", () => {
  it("parses objects and arrays", () => {
    expect(json().parse('{"a":1}')).toEqual({ a: 1 });
    expect(json<number[]>().parse("[1,2,3]")).toEqual([1, 2, 3]);
  });
  it("rejects invalid JSON", () => {
    expect(() => json().parse("nope")).toThrow(/valid JSON/);
  });
});

describe("metadata & example generation", () => {
  it("records secret / description flags", () => {
    const v = str().secret().desc("the API key");
    expect(v.meta.secret).toBe(true);
    expect(v.meta.description).toBe("the API key");
  });
  it("exampleValue uses the default when present", () => {
    expect(port().default(4000).exampleValue()).toBe("4000");
    expect(oneOf(["a", "b"]).default("b").exampleValue()).toBe("b");
  });
  it("exampleValue falls back to a type placeholder", () => {
    expect(port().exampleValue()).toBe("3000");
    expect(bool().exampleValue()).toBe("false");
    expect(url().exampleValue()).toBe("https://example.com");
    expect(oneOf(["dev", "prod"]).exampleValue()).toBe("dev");
    expect(str().exampleValue()).toBe("");
  });
});
