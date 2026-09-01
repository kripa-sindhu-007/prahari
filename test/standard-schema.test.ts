import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import * as v from "valibot";
import { type } from "arktype";

import {
  defineEnv,
  standard,
  isStandardSchema,
  str,
  port,
  EnvValidationError,
} from "../src/index";
import { renderEnvExample } from "../src/cli/example";
import { renderDocs } from "../src/cli/docs";
import { clearRegistry } from "../src/registry";

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

describe("bare Standard Schema fields", () => {
  it("accepts a Zod validator and coerces through it (acceptance: z.coerce.number)", () => {
    const env = defineEnv(
      { PORT: z.coerce.number(), NAME: z.string() },
      { source: { PORT: "8080", NAME: "svc" } },
    );
    expect(env.PORT).toBe(8080);
    expect(env.NAME).toBe("svc");
  });

  it("works with Valibot", () => {
    const env = defineEnv(
      { COUNT: v.pipe(v.string(), v.transform(Number), v.number()) },
      { source: { COUNT: "3" } },
    );
    expect(env.COUNT).toBe(3);
  });

  it("works with ArkType", () => {
    const env = defineEnv(
      { NAME: type("string") },
      { source: { NAME: "hello" } },
    );
    expect(env.NAME).toBe("hello");
  });
});

describe("mixed built-in + Standard Schema (acceptance criterion)", () => {
  it("validates a schema that mixes both kinds", () => {
    const env = defineEnv(
      {
        PORT: port().default(3000), // built-in
        REGION: z.enum(["us", "eu"]), // zod
        FLAG: v.pipe(v.string(), v.transform((s) => s === "on")), // valibot
        NAME: str(), // built-in
      },
      { source: { REGION: "eu", FLAG: "on", NAME: "svc" } },
    );
    expect(env.PORT).toBe(3000);
    expect(env.REGION).toBe("eu");
    expect(env.FLAG).toBe(true);
    expect(env.NAME).toBe("svc");
  });
});

describe("Standard Schema failures render in the boot report", () => {
  it("maps a Zod issue into the aggregate report, tagged with the vendor", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        { PORT: z.coerce.number().int().positive(), NAME: str() },
        { source: { PORT: "-1" } }, // PORT invalid, NAME missing
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    const keys = error!.failures.map((f) => f.key).sort();
    expect(keys).toEqual(["NAME", "PORT"]);
    const portFail = error!.failures.find((f) => f.key === "PORT")!;
    expect(portFail.expected).toBe("zod"); // vendor as the type label
    expect(portFail.reason.length).toBeGreaterThan(0);
  });

  it("collects failures across built-in and Standard Schema fields together", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        { PORT: port(), TOKEN: z.string().min(10) },
        { source: { PORT: "not-a-port", TOKEN: "short" } },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error!.failures).toHaveLength(2);
  });
});

describe("secret redaction with the standard() wrapper", () => {
  it("redacts a wrapped secret in the report and never leaks the raw value", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv(
        { API_KEY: standard(z.string().startsWith("sk_"), { secret: true }) },
        { source: { API_KEY: "pk_supersecret_value" } },
      );
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error!.message).not.toContain("supersecret");
    expect(error!.failures[0]!.received).toBe("***");
  });

  it("passes a valid wrapped value through", () => {
    const env = defineEnv(
      { API_KEY: standard(z.string().startsWith("sk_"), { secret: true }) },
      { source: { API_KEY: "sk_live_abc" } },
    );
    expect(env.API_KEY).toBe("sk_live_abc");
  });
});

describe("async schemas are rejected synchronously with a clear error", () => {
  // A hand-rolled async Standard Schema (mimics `.refine(async …)`).
  const asyncSchema = {
    "~standard": {
      version: 1 as const,
      vendor: "custom",
      validate: async (value: unknown) => ({ value }),
    },
  };

  it("reports an async schema with a clear, synchronous error", () => {
    expect(() =>
      defineEnv({ X: asyncSchema }, { source: { X: "1" } }),
    ).toThrow(/synchronously/);
  });

  it("collects the async failure alongside other failures (no short-circuit)", () => {
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ X: asyncSchema, Y: str() }, { source: { X: "1" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    // Both the async schema AND the missing built-in must appear.
    expect(error!.failures.map((f) => f.key).sort()).toEqual(["X", "Y"]);
    // The async failure never carries a `received` value (no leak).
    expect(error!.failures.find((f) => f.key === "X")!.received).toBeUndefined();
  });

  it("reports a validator that returns no result object", () => {
    const bad = {
      "~standard": { version: 1 as const, vendor: "custom", validate: () => undefined },
    } as unknown;
    let error: EnvValidationError | undefined;
    try {
      defineEnv({ Z: bad as never }, { source: { Z: "1" } });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error!.failures[0]!.reason).toMatch(/no result/);
  });
});

describe("isStandardSchema guard", () => {
  it("recognizes Standard Schema validators and rejects built-ins/plain objects", () => {
    expect(isStandardSchema(z.string())).toBe(true);
    expect(isStandardSchema(v.string())).toBe(true);
    expect(isStandardSchema(str())).toBe(false);
    expect(isStandardSchema({})).toBe(false);
    expect(isStandardSchema(null)).toBe(false);
  });
});

describe("CLI introspection tolerates bare Standard Schema fields", () => {
  const schema = {
    PORT: port().default(3000),
    REGION: z.enum(["us", "eu"]),
    TOKEN: standard(z.string(), { secret: true, desc: "Service token" }),
  };

  it("renders .env.example without crashing and marks the SS field", () => {
    const out = renderEnvExample(schema);
    expect(out).toContain("PORT=3000");
    expect(out).toContain("REGION=");
    expect(out).toContain("standard-schema"); // bare SS gets the marker tag
    // wrapped secret: value left blank
    expect(out).toMatch(/TOKEN=\n/);
  });

  it("renders the docs table, showing '?' for a bare SS field's required cell", () => {
    const out = renderDocs(schema);
    expect(out).toContain("| `PORT` |");
    expect(out).toContain("| `REGION` | zod | ? |"); // opaque → unknown required
    expect(out).toContain("Service token"); // wrapped field keeps its description
  });
});
