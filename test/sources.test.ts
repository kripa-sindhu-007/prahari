import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { defineEnv, port, str, type EnvSource } from "../src/index";
import { clearRegistry } from "../src/registry";

/**
 * #6 — the pluggable source boundary: a plain record, a `get(key)` source, and
 * runtimes that have no `process` at all (Cloudflare Workers, Deno Deploy).
 */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

describe("source: plain record", () => {
  it("reads values from the supplied record", () => {
    const env = defineEnv({ PORT: port() }, { source: { PORT: "8080" } });
    expect(env.PORT).toBe(8080);
  });

  it("defaults to process.env when no source is given", () => {
    process.env.PRAHARI_TEST_SOURCE = "from-process";
    try {
      const env = defineEnv({ PRAHARI_TEST_SOURCE: str() });
      expect(env.PRAHARI_TEST_SOURCE).toBe("from-process");
    } finally {
      delete process.env.PRAHARI_TEST_SOURCE;
    }
  });
});

describe("source: get(key) interface", () => {
  it("reads through a getter source", () => {
    const bindings = new Map([["PORT", "9000"]]);
    const source: EnvSource = { get: (key) => bindings.get(key) };
    const env = defineEnv({ PORT: port() }, { source });
    expect(env.PORT).toBe(9000);
  });

  it("only asks for keys the schema declares", () => {
    const asked: string[] = [];
    const source: EnvSource = {
      get(key) {
        asked.push(key);
        return key === "A" ? "1" : undefined;
      },
    };
    defineEnv({ A: str(), B: str().optional() }, { source });
    expect(asked).toEqual(["A", "B"]);
  });

  it("a Map's own get is enough to act as a source", () => {
    const source = new Map([["NAME", "svc"]]) as unknown as EnvSource;
    const env = defineEnv({ NAME: str() }, { source });
    expect(env.NAME).toBe("svc");
  });

  it("reports a missing variable from a getter source like any other", () => {
    const source: EnvSource = { get: () => undefined };
    expect(() => defineEnv({ SECRET_KEY: str() }, { source })).toThrow(
      /SECRET_KEY/,
    );
  });

  it("does not mistake a record with a string 'get' key for a getter", () => {
    const env = defineEnv(
      { get: str(), PORT: port() },
      { source: { get: "a-real-value", PORT: "3000" } },
    );
    expect(env.get).toBe("a-real-value");
    expect(env.PORT).toBe(3000);
  });
});

describe("source: runtimes without process", () => {
  // Edge runtimes have no `process` binding at all. Reading `process.env`
  // unguarded there throws a ReferenceError instead of producing a report.
  const withoutProcess = (fn: () => void) => {
    const original = globalThis.process;
    // @ts-expect-error — deliberately simulating an edge runtime
    delete globalThis.process;
    try {
      fn();
    } finally {
      globalThis.process = original;
    }
  };

  it("validates against an explicit source with no process present", () => {
    withoutProcess(() => {
      const env = defineEnv(
        { API_URL: str() },
        { source: { API_URL: "https://edge.example" } },
      );
      expect(env.API_URL).toBe("https://edge.example");
    });
  });

  it("falls back to an empty source instead of throwing a ReferenceError", () => {
    withoutProcess(() => {
      let error: unknown;
      try {
        defineEnv({ API_URL: str() });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
      // The point: a normal validation report, NOT `process is not defined`.
      expect((error as Error).name).toBe("EnvValidationError");
      expect((error as Error).message).toMatch(/API_URL/);
      expect((error as Error).message).not.toMatch(/process is not defined/);
    });
  });

  it("still applies defaults with no process present", () => {
    withoutProcess(() => {
      const env = defineEnv({ PORT: port().default(3000) });
      expect(env.PORT).toBe(3000);
    });
  });
});

afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
