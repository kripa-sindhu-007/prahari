import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  defineEnv,
  EnvValidationError,
  num,
  port,
  safeParse,
  str,
} from "../src/index";
import { clearRegistry, getRegisteredSchema } from "../src/registry";

/** #24 — the non-throwing variant. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

describe("safeParse — success", () => {
  it("returns success with typed data", () => {
    const result = safeParse(
      { PORT: port(), NAME: str() },
      { source: { PORT: "8080", NAME: "svc" } },
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.PORT).toBe(8080);
    expect(result.error).toBeUndefined();
    const typed: number = result.data.PORT;
    expect(typed).toBe(8080);
  });

  it("freezes the data, like defineEnv", () => {
    const result = safeParse({ A: str() }, { source: { A: "x" } });
    if (!result.success) throw new Error("expected success");
    expect(Object.isFrozen(result.data)).toBe(true);
  });

  it("registers the schema so the CLI still sees it", () => {
    safeParse({ A: str() }, { source: { A: "x" } });
    expect(Object.keys(getRegisteredSchema())).toEqual(["A"]);
  });
});

describe("safeParse — failure", () => {
  it("returns the aggregate error instead of throwing", () => {
    let threw = false;
    let result;
    try {
      result = safeParse(
        { DATABASE_URL: str(), PORT: port(), RETRIES: num().int() },
        { source: { PORT: "80.5", RETRIES: "abc" } },
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result?.success).toBe(false);
    if (result?.success !== false) throw new Error("expected failure");
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(EnvValidationError);
    expect(result.error.failures.map((f) => f.key)).toEqual([
      "DATABASE_URL",
      "PORT",
      "RETRIES",
    ]);
  });

  it("produces the same report as defineEnv's throw", () => {
    const schema = { PORT: port(), NAME: str() };
    const source = { PORT: "not-a-port" };

    const result = safeParse(schema, { source });
    let thrown: EnvValidationError | undefined;
    try {
      defineEnv(schema, { source });
    } catch (e) {
      thrown = e as EnvValidationError;
    }

    if (result.success) throw new Error("expected failure");
    expect(result.error.message).toBe(thrown?.message);
    expect(result.error.failures).toEqual(thrown?.failures);
  });

  it("redacts secrets in the returned error", () => {
    const result = safeParse(
      { TOKEN: str().secret().min(10) },
      { source: { TOKEN: "short" } },
    );
    if (result.success) throw new Error("expected failure");
    expect(result.error.failures[0]?.received).toBe("***");
  });
});

describe("safeParse — edges", () => {
  it("is reachable as defineEnv.safeParse", () => {
    expect(defineEnv.safeParse).toBe(safeParse);
    const result = defineEnv.safeParse({ A: str() }, { source: { A: "x" } });
    expect(result.success).toBe(true);
  });

  it("defaults to process.env with no options", () => {
    process.env.PRAHARI_TEST_SAFE = "yes";
    try {
      const result = safeParse({ PRAHARI_TEST_SAFE: str() });
      expect(result.success).toBe(true);
    } finally {
      delete process.env.PRAHARI_TEST_SAFE;
    }
  });

  it("still propagates a genuine bug inside a validator (not a config error)", () => {
    const exploding = {
      typeName: "boom",
      meta: { typeName: "boom", secret: false, optional: false, hasDefault: false },
      parse() {
        throw new TypeError("validator bug");
      },
      exampleValue: () => "",
    };
    expect(() => safeParse({ A: exploding }, { source: { A: "x" } })).toThrow(
      TypeError,
    );
  });

  it("returns success in CLI introspection mode", () => {
    process.env.PRAHARI_SKIP_VALIDATION = "1";
    const result = safeParse({ REQUIRED: str() }, { source: {} });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.REQUIRED).toBeUndefined();
    // The schema is still registered for the CLI to read back.
    expect(Object.keys(getRegisteredSchema())).toEqual(["REQUIRED"]);
  });
});
