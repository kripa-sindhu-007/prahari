import { describe, it, expect, beforeEach } from "vitest";

import {
  custom,
  defineEnv,
  EnvFieldError,
  EnvValidationError,
  json,
  num,
  str,
} from "../src/index";
import { describeField } from "../src/validators";
import { clearRegistry } from "../src/registry";

/** #26 — zero-dependency extensibility: `custom()` and `.transform()`. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

const uuid = custom((raw) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)) {
    throw new Error("must be a UUID");
  }
  return raw;
});

describe("custom()", () => {
  it("coerces a bespoke type with a typed result", () => {
    const env = defineEnv(
      { TENANT: custom((raw) => raw.split(",").map((s) => s.trim())) },
      { source: { TENANT: "a, b ,c" } },
    );
    expect(env.TENANT).toEqual(["a", "b", "c"]);
  });

  it("reports a plain thrown Error as a normal report row", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ REQUEST_ID: uuid }, { source: { REQUEST_ID: "nope" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error?.failures).toEqual([
      { key: "REQUEST_ID", reason: "must be a UUID", received: "nope", expected: "custom" },
    ]);
  });

  it("accepts an EnvFieldError thrown directly", () => {
    const v = custom(() => {
      throw new EnvFieldError("must be signed");
    });
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ TOKEN: v }, { source: { TOKEN: "x" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures[0]?.reason).toBe("must be signed");
  });

  it("normalizes a non-Error throw and an empty message", () => {
    const thrown = custom(() => {
      throw "just a string";
    });
    const empty = custom(() => {
      throw new Error("");
    });
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ A: thrown, B: empty }, { source: { A: "x", B: "y" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures.map((f) => f.reason)).toEqual([
      "just a string",
      "failed validation",
    ]);
  });

  it("supports the shared modifiers", () => {
    const env = defineEnv(
      {
        MODE: custom((raw) => raw.toUpperCase())
          .desc("upper-cased mode")
          .default("FALLBACK"),
        MAYBE: custom((raw) => raw.length).optional(),
      },
      { source: {} },
    );
    expect(env.MODE).toBe("FALLBACK");
    expect(env.MAYBE).toBeUndefined();
  });

  it("redacts a secret custom field in the report", () => {
    const v = custom(
      () => {
        throw new Error("must be signed");
      },
      { secret: true, typeName: "jwt" },
    );
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ TOKEN: v }, { source: { TOKEN: "super-secret" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures[0]).toEqual({
      key: "TOKEN",
      reason: "must be signed",
      received: "***",
      expected: "jwt",
    });
  });

  it("carries metadata into the field descriptor for docs / .env.example", () => {
    const d = describeField(
      custom((raw) => raw, {
        desc: "AWS region",
        example: "us-east-1",
        typeName: "region",
      }),
    );
    expect(d.typeName).toBe("region");
    expect(d.description).toBe("AWS region");
    expect(d.opaque).toBe(false);
    expect(d.exampleValue()).toBe("us-east-1");
  });

  it("falls back to a stringified default as its example", () => {
    expect(describeField(custom((raw) => raw).default("dev")).exampleValue()).toBe("dev");
    expect(describeField(custom((raw) => raw.length).default(3)).exampleValue()).toBe("3");
    expect(describeField(custom((raw) => raw)).exampleValue()).toBe("");
  });
});

describe(".transform()", () => {
  it("maps a validated value and updates the inferred type", () => {
    const env = defineEnv(
      { TAGS: str().transform((s) => s.split(",")) },
      { source: { TAGS: "a,b" } },
    );
    expect(env.TAGS).toEqual(["a", "b"]);
    const typed: string[] = env.TAGS;
    expect(typed).toHaveLength(2);
  });

  it("runs after the inner coercion AND its checks", () => {
    const calls: number[] = [];
    const schema = {
      N: num()
        .int()
        .min(10)
        .transform((n) => {
          calls.push(n);
          return n * 2;
        }),
    };
    // Check failure short-circuits — the transform never sees an invalid value.
    expect(() => defineEnv(schema, { source: { N: "5" } })).toThrow(/must be >= 10/);
    expect(calls).toEqual([]);

    const env = defineEnv(schema, { source: { N: "21" } });
    expect(env.N).toBe(42);
    expect(calls).toEqual([21]);
  });

  it("reports a throw inside the transform as a report row", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        {
          CONFIG: json<{ id?: string }>().transform((v) => {
            if (!v.id) throw new Error("must contain an id");
            return v.id;
          }),
        },
        { source: { CONFIG: "{}" } },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error?.failures[0]?.reason).toBe("must contain an id");
    expect(error?.failures[0]?.expected).toBe("json");
  });

  it("types .default() and .optional() chained after it at the transformed type", () => {
    const env = defineEnv(
      {
        TAGS: str()
          .transform((s) => s.split(","))
          .default([]),
        EXTRA: str()
          .transform((s) => s.length)
          .optional(),
      },
      { source: {} },
    );
    expect(env.TAGS).toEqual([]);
    expect(env.EXTRA).toBeUndefined();
  });

  it("transforms a default declared BEFORE it, once, at declaration time", () => {
    let applied = 0;
    const field = str()
      .default("a,b")
      .transform((s) => {
        applied += 1;
        return s.split(",");
      });
    expect(applied).toBe(1); // eager — the declared default is already transformed

    const env = defineEnv({ TAGS: field }, { source: {} });
    expect(env.TAGS).toEqual(["a", "b"]);
    expect(applied).toBe(1); // absent value: no second run
  });

  it("throws at declaration when the declared default cannot survive the transform", () => {
    expect(() =>
      str()
        .default("nope")
        .transform((s) => {
          if (s !== "ok") throw new Error("bad default");
          return s;
        }),
    ).toThrow(/\.transform\(\) failed on the declared default: bad default/);
  });

  it("carries desc and secret across, and keeps the RAW example", () => {
    const field = str()
      .desc("comma-separated tags")
      .secret()
      .default("a,b")
      .transform((s) => s.split(","));
    const d = describeField(field);
    expect(d.description).toBe("comma-separated tags");
    expect(d.secret).toBe(true);
    expect(d.typeName).toBe("string");
    // The .env.example must show what a user types, not the transformed value.
    expect(d.exampleValue()).toBe("a,b");
  });

  it("keeps the raw placeholder when there is no default", () => {
    expect(describeField(num().transform((n) => `${n}`)).exampleValue()).toBe("0");
  });

  it("chains", () => {
    const env = defineEnv(
      {
        N: str()
          .transform((s) => s.trim())
          .transform((s) => s.length),
      },
      { source: { N: "  abc  " } },
    );
    expect(env.N).toBe(3);
  });
});
