import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

import { defineNextEnv } from "../src/next/index";
import { str, url, port, EnvValidationError } from "../src/index";
import { clearRegistry, getRegisteredSchema } from "../src/registry";

beforeEach(() => {
  clearRegistry();
  delete process.env.PRAHARI_SKIP_VALIDATION;
});
afterEach(() => {
  delete process.env.PRAHARI_SKIP_VALIDATION;
});

const runtime = {
  DATABASE_URL: "postgres://localhost/app",
  STRIPE_KEY: "sk_live_123",
  NEXT_PUBLIC_API_URL: "https://api.example.com",
};

describe("defineNextEnv — server context", () => {
  it("validates and types both server and client vars", () => {
    const env = defineNextEnv({
      server: { DATABASE_URL: str(), STRIPE_KEY: str().secret() },
      client: { NEXT_PUBLIC_API_URL: url() },
      runtimeEnv: runtime,
      isServer: true,
    });
    expect(env.DATABASE_URL).toBe("postgres://localhost/app");
    expect(env.STRIPE_KEY).toBe("sk_live_123");
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("composes with Standard Schema (Zod) fields", () => {
    const env = defineNextEnv({
      server: { PORT: z.coerce.number() },
      client: { NEXT_PUBLIC_REGION: z.enum(["us", "eu"]) },
      runtimeEnv: { PORT: "8080", NEXT_PUBLIC_REGION: "eu" },
      isServer: true,
    });
    expect(env.PORT).toBe(8080);
    expect(env.NEXT_PUBLIC_REGION).toBe("eu");
  });

  it("registers the merged schema so the CLI can introspect it", () => {
    defineNextEnv({
      server: { DATABASE_URL: str() },
      client: { NEXT_PUBLIC_API_URL: url() },
      runtimeEnv: runtime,
      isServer: true,
    });
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual([
      "DATABASE_URL",
      "NEXT_PUBLIC_API_URL",
    ]);
  });

  it("aggregates validation failures into the standard report", () => {
    let error: EnvValidationError | undefined;
    try {
      defineNextEnv({
        server: { DATABASE_URL: str() },
        client: { NEXT_PUBLIC_API_URL: url() },
        runtimeEnv: { NEXT_PUBLIC_API_URL: "not-a-url" }, // DB missing, url invalid
        isServer: true,
      });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error!.failures.map((f) => f.key).sort()).toEqual([
      "DATABASE_URL",
      "NEXT_PUBLIC_API_URL",
    ]);
  });
});

describe("defineNextEnv — client context (boundary guard)", () => {
  it("validates only client vars and lets client vars through", () => {
    // Server values are absent on the client — must NOT be required/validated.
    const env = defineNextEnv({
      server: { DATABASE_URL: str() },
      client: { NEXT_PUBLIC_API_URL: url() },
      runtimeEnv: { NEXT_PUBLIC_API_URL: "https://api.example.com" },
      isServer: false,
    });
    expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
  });

  it("throws a clear error when a server var is read on the client", () => {
    const env = defineNextEnv({
      server: { DATABASE_URL: str() },
      client: { NEXT_PUBLIC_API_URL: url() },
      runtimeEnv: { NEXT_PUBLIC_API_URL: "https://api.example.com" },
      isServer: false,
    });
    expect(() => env.DATABASE_URL).toThrow(/server-only variable "DATABASE_URL" on the client/);
  });
});

describe("defineNextEnv — prefix invariants", () => {
  it("rejects a client var without the public prefix", () => {
    expect(() =>
      defineNextEnv({
        client: { API_URL: url() }, // missing NEXT_PUBLIC_
        runtimeEnv: { API_URL: "https://x" },
        isServer: true,
      }),
    ).toThrow(/must start with "NEXT_PUBLIC_"/);
  });

  it("rejects a server var that carries the public prefix (leak risk)", () => {
    expect(() =>
      defineNextEnv({
        server: { NEXT_PUBLIC_SECRET: str() },
        runtimeEnv: { NEXT_PUBLIC_SECRET: "x" },
        isServer: true,
      }),
    ).toThrow(/must NOT start with "NEXT_PUBLIC_"/);
  });

  it("honors a custom clientPrefix", () => {
    const env = defineNextEnv({
      client: { PUBLIC_FLAG: str() },
      runtimeEnv: { PUBLIC_FLAG: "on" },
      clientPrefix: "PUBLIC_",
      isServer: true,
    });
    expect(env.PUBLIC_FLAG).toBe("on");
  });
});

describe("defineNextEnv — CLI skip mode", () => {
  it("registers the schema but neither validates nor throws", () => {
    process.env.PRAHARI_SKIP_VALIDATION = "1";
    const env = defineNextEnv({
      server: { DATABASE_URL: port() }, // would fail if validated
      client: { NEXT_PUBLIC_API_URL: url() },
      runtimeEnv: {},
      isServer: true,
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual([
      "DATABASE_URL",
      "NEXT_PUBLIC_API_URL",
    ]);
  });
});
