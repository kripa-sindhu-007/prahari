import { describe, it, expect, beforeEach } from "vitest";

import {
  defineEnv,
  defineSchema,
  isComposedSchema,
  oneOf,
  port,
  str,
  safeParse,
} from "../src/index";
import { defineNextEnv } from "../src/next/index";
import { clearRegistry, getRegisteredSchema } from "../src/registry";

/** #5 — composable schemas: a shared base that packages extend. */

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

const base = defineSchema({
  LOG_LEVEL: oneOf(["debug", "info", "warn"]).default("info"),
  SERVICE_NAME: str(),
});

describe("defineSchema", () => {
  it("is accepted by defineEnv in place of a plain record", () => {
    const env = defineEnv(base, { source: { SERVICE_NAME: "api" } });
    expect(env.SERVICE_NAME).toBe("api");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("extends with additional fields", () => {
    const env = defineEnv(base.extend({ PORT: port() }), {
      source: { SERVICE_NAME: "api", PORT: "8080" },
    });
    expect(env.PORT).toBe(8080);
    expect(env.SERVICE_NAME).toBe("api");
  });

  it("lets a later key override an earlier one (last write wins)", () => {
    const overridden = base.extend({ LOG_LEVEL: oneOf(["silent"]).default("silent") });
    const env = defineEnv(overridden, { source: { SERVICE_NAME: "api" } });
    expect(env.LOG_LEVEL).toBe("silent");
  });

  it("never mutates the base when extended", () => {
    const extended = base.extend({ PORT: port() });
    expect(Object.keys(base.fields).sort()).toEqual(["LOG_LEVEL", "SERVICE_NAME"]);
    expect(Object.keys(extended.fields).sort()).toEqual([
      "LOG_LEVEL",
      "PORT",
      "SERVICE_NAME",
    ]);
    // Two independent apps extending the same base stay independent.
    const other = base.extend({ QUEUE_URL: str() });
    expect(Object.keys(other.fields)).not.toContain("PORT");
  });

  it("copies the caller's record so later mutation cannot leak in", () => {
    const fields = { A: str() };
    const schema = defineSchema(fields);
    (fields as Record<string, unknown>).B = str();
    expect(Object.keys(schema.fields)).toEqual(["A"]);
  });

  it("chains extends", () => {
    const env = defineEnv(base.extend({ PORT: port() }).extend({ REGION: str() }), {
      source: { SERVICE_NAME: "api", PORT: "1", REGION: "eu" },
    });
    expect(env.REGION).toBe("eu");
  });

  it("merges another schema — plain or composed", () => {
    const plain = defineEnv(base.merge({ PORT: port() }), {
      source: { SERVICE_NAME: "api", PORT: "80" },
    });
    expect(plain.PORT).toBe(80);

    const composed = defineEnv(base.merge(defineSchema({ REGION: str() })), {
      source: { SERVICE_NAME: "api", REGION: "us" },
    });
    expect(composed.REGION).toBe("us");
  });

  it("exposes the flattened fields to the CLI registry", () => {
    defineEnv(base.extend({ PORT: port() }), {
      source: { SERVICE_NAME: "api", PORT: "80" },
    });
    // What `prahari example|sync|docs` introspects — a plain record, with no
    // composition machinery leaking in as a fake variable.
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual([
      "LOG_LEVEL",
      "PORT",
      "SERVICE_NAME",
    ]);
  });

  it("works with safeParse", () => {
    const result = safeParse(base.extend({ PORT: port() }), {
      source: { SERVICE_NAME: "api", PORT: "80" },
    });
    expect(result.success).toBe(true);
  });

  it("is accepted by the framework adapters", () => {
    const env = defineNextEnv({
      server: defineSchema({ DATABASE_URL: str() }),
      client: defineSchema({ NEXT_PUBLIC_API_URL: str() }),
      runtimeEnv: {
        DATABASE_URL: "postgres://localhost",
        NEXT_PUBLIC_API_URL: "https://api.example",
      },
      isServer: true,
    });
    expect(env.DATABASE_URL).toBe("postgres://localhost");
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example");
  });
});

describe("isComposedSchema", () => {
  it("distinguishes a composed schema from a plain record", () => {
    expect(isComposedSchema(base)).toBe(true);
    expect(isComposedSchema({ A: str() })).toBe(false);
    expect(isComposedSchema(null)).toBe(false);
    expect(isComposedSchema(undefined)).toBe(false);
    expect(isComposedSchema("nope")).toBe(false);
  });
});
