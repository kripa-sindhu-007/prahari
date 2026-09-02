import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { defineEnv, str, num, port, bool, oneOf, EnvValidationError } from "../src/index";
import { clearRegistry, getRegisteredSchema } from "../src/registry";

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

describe("defineEnv — happy path", () => {
  it("coerces and types every field from a custom source", () => {
    const env = defineEnv(
      {
        NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
        PORT: port().default(3000),
        DEBUG: bool().default(false),
        NAME: str(),
      },
      { source: { PORT: "8080", DEBUG: "true", NAME: "svc" } },
    );

    expect(env.PORT).toBe(8080);
    expect(env.DEBUG).toBe(true);
    expect(env.NAME).toBe("svc");
    expect(env.NODE_ENV).toBe("development"); // default applied

    // Type-level: PORT is number, NODE_ENV is the union.
    const _p: number = env.PORT;
    const _n: "development" | "production" | "test" = env.NODE_ENV;
    void _p;
    void _n;
  });

  it("freezes the returned object", () => {
    const env = defineEnv({ A: str() }, { source: { A: "x" } });
    expect(Object.isFrozen(env)).toBe(true);
    expect(() => {
      // @ts-expect-error — readonly at the type level too
      env.A = "y";
    }).toThrow();
  });
});

describe("defineEnv — failure path", () => {
  it("aggregates all failures into one EnvValidationError", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        {
          DATABASE_URL: str(),
          PORT: port(),
          RETRIES: num().int(),
        },
        { source: { PORT: "80.5", RETRIES: "abc" } },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }

    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error!.failures).toHaveLength(3);
    const keys = error!.failures.map((f) => f.key).sort();
    expect(keys).toEqual(["DATABASE_URL", "PORT", "RETRIES"]);
    // The report is human-readable and names each variable.
    expect(error!.message).toContain("DATABASE_URL");
    expect(error!.message).toContain("failed validation");
  });

  it("redacts secret values in the failure report", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        { API_KEY: str().secret().startsWith("sk_") },
        { source: { API_KEY: "pk_supersecret_value" } },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    // The raw secret must never appear in the report...
    expect(error!.message).not.toContain("supersecret");
    // ...it is shown redacted.
    expect(error!.failures[0]!.received).toBe("***");
    expect(error!.message).toContain("***");
  });

  it("reports a missing required variable as '(not set)'-style, no 'received'", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ MISSING: str() }, { source: {} });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error!.failures[0]!.reason).toMatch(/required/);
    expect(error!.failures[0]!.received).toBeUndefined();
    expect(error!.message).not.toContain("received:");
  });
});

describe("defineEnv — registry & introspection", () => {
  it("registers the schema so tooling can read it", () => {
    const schema = { PORT: port(), NAME: str() };
    defineEnv(schema, { source: { PORT: "3000", NAME: "x" } });
    const registered = getRegisteredSchema();
    expect(Object.keys(registered).sort()).toEqual(["NAME", "PORT"]);
  });

  it("skip mode registers the schema but never validates or throws", () => {
    process.env.PRAHARI_SKIP_VALIDATION = "1";
    // Missing required PORT would normally throw — in skip mode it must not.
    const env = defineEnv({ PORT: port(), URL: str() }, { source: {} });
    expect(env.PORT).toBeUndefined();
    expect(env.URL).toBeUndefined();
    // ...but the schema is still discoverable for the CLI.
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual(["PORT", "URL"]);
  });
});

describe("defineEnv — secret redaction edges", () => {
  it("reports an explicitly empty secret as empty, not as ***", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ TOKEN: str().secret() }, { source: { TOKEN: "" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    // An empty value is already no secret to leak — redacting it would only
    // hide that the variable is set-but-blank.
    expect(error?.failures[0]).toEqual({
      key: "TOKEN",
      reason: "is required but was not set",
      received: "",
      expected: "string",
    });
  });
});
