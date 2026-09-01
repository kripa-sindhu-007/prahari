import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

import { defineViteEnv } from "../src/vite/index";
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
  VITE_API_URL: "https://api.example.com",
};

describe("defineViteEnv — server context", () => {
  it("validates and types both server and client vars", () => {
    const env = defineViteEnv({
      server: { DATABASE_URL: str() },
      client: { VITE_API_URL: url() },
      runtimeEnv: runtime,
      isServer: true,
    });
    expect(env.DATABASE_URL).toBe("postgres://localhost/app");
    expect(env.VITE_API_URL).toBe("https://api.example.com");
  });

  it("composes with Standard Schema (Zod) fields", () => {
    const env = defineViteEnv({
      server: { PORT: z.coerce.number() },
      client: { VITE_REGION: z.enum(["us", "eu"]) },
      runtimeEnv: { PORT: "8080", VITE_REGION: "eu" },
      isServer: true,
    });
    expect(env.PORT).toBe(8080);
    expect(env.VITE_REGION).toBe("eu");
  });

  it("registers the merged schema so the CLI can introspect it", () => {
    defineViteEnv({
      server: { DATABASE_URL: str() },
      client: { VITE_API_URL: url() },
      runtimeEnv: runtime,
      isServer: true,
    });
    expect(Object.keys(getRegisteredSchema()).sort()).toEqual([
      "DATABASE_URL",
      "VITE_API_URL",
    ]);
  });
});

describe("defineViteEnv — client context (boundary guard)", () => {
  it("validates only client vars and lets client vars through", () => {
    const env = defineViteEnv({
      server: { DATABASE_URL: str() },
      client: { VITE_API_URL: url() },
      runtimeEnv: { VITE_API_URL: "https://api.example.com" },
      isServer: false,
    });
    expect(env.VITE_API_URL).toBe("https://api.example.com");
  });

  it("throws a clear error when a server var is read on the client", () => {
    const env = defineViteEnv({
      server: { DATABASE_URL: str() },
      client: { VITE_API_URL: url() },
      runtimeEnv: { VITE_API_URL: "https://api.example.com" },
      isServer: false,
    });
    expect(() => env.DATABASE_URL).toThrow(/server-only variable "DATABASE_URL" on the client/);
  });
});

describe("defineViteEnv — prefix invariants", () => {
  it("rejects a client var without the VITE_ prefix", () => {
    expect(() =>
      defineViteEnv({
        client: { API_URL: url() },
        runtimeEnv: { API_URL: "https://x" },
        isServer: true,
      }),
    ).toThrow(/must start with "VITE_"/);
  });

  it("rejects a server var that carries the VITE_ prefix (leak risk)", () => {
    expect(() =>
      defineViteEnv({
        server: { VITE_SECRET: str() },
        runtimeEnv: { VITE_SECRET: "x" },
        isServer: true,
      }),
    ).toThrow(/must NOT start with "VITE_"/);
  });

  it("honors a custom clientPrefix (envPrefix override)", () => {
    const env = defineViteEnv({
      client: { PUBLIC_FLAG: str() },
      runtimeEnv: { PUBLIC_FLAG: "on" },
      clientPrefix: "PUBLIC_",
      isServer: true,
    });
    expect(env.PUBLIC_FLAG).toBe("on");
  });

  it("error messages are tagged with the vite adapter", () => {
    expect(() =>
      defineViteEnv({ client: { API: url() }, runtimeEnv: {}, isServer: true }),
    ).toThrow(/prahari\/vite:/);
  });
});

describe("defineViteEnv — failure aggregation", () => {
  it("aggregates validation failures into the standard report", () => {
    let error: EnvValidationError | undefined;
    try {
      defineViteEnv({
        server: { DATABASE_URL: str() },
        client: { VITE_PORT: port() },
        runtimeEnv: { VITE_PORT: "not-a-port" },
        isServer: true,
      });
    } catch (e) {
      error = e as EnvValidationError;
    }
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error!.failures.map((f) => f.key).sort()).toEqual(["DATABASE_URL", "VITE_PORT"]);
  });
});
