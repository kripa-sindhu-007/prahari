# prahari recipes

Common, copy-pasteable patterns. Each is self-contained; adapt the variable
names to your app. New to prahari? Start with the [README](../README.md).

## Table of contents

- [Validate at boot in a Node service](#validate-at-boot-in-a-node-service)
- [Bring your own Zod / Valibot / ArkType](#bring-your-own-zod--valibot--arktype)
- [Mixed built-ins and Standard Schema](#mixed-built-ins-and-standard-schema)
- [Next.js: server/client split](#nextjs-serverclient-split)
- [Vite: server/client split](#vite-serverclient-split)
- [Monorepo: share a base schema](#monorepo-share-a-base-schema)
- [Test code that reads env](#test-code-that-reads-env)
- [A bespoke type, without a schema library](#a-bespoke-type-without-a-schema-library)
- [Edge runtimes (no `process.env`)](#edge-runtimes-no-processenv)
- [Required in production only](#required-in-production-only)
- [Lists, durations and sizes](#lists-durations-and-sizes)
- [Load a `.env` file yourself](#load-a-env-file-yourself)
- [Keep `.env.example` honest in CI](#keep-envexample-honest-in-ci)
- [Secrets and redaction](#secrets-and-redaction)
- [Defaults, optional, and the empty-string rule](#defaults-optional-and-the-empty-string-rule)

## Validate at boot in a Node service

Define your env once, in a module imported early. If anything is missing or
malformed the process refuses to start with one readable report.

```ts
// env.ts
import { defineEnv, str, port, bool, oneOf } from "prahari";

export const env = defineEnv({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  PORT: port().default(3000),
  DATABASE_URL: str().desc("Postgres connection string"),
  LOG_JSON: bool().default(false),
});
```

```ts
// server.ts — first import, so validation runs before anything else
import { env } from "./env";
app.listen(env.PORT); // typed as number
```

## Bring your own Zod / Valibot / ArkType

Any [Standard Schema](https://standardschema.dev) validator works as a field.

```ts
import { defineEnv } from "prahari";
import { z } from "zod";

export const env = defineEnv({
  PORT: z.coerce.number().int().positive(),
  REGION: z.enum(["us", "eu"]),   // inferred as "us" | "eu"
  DATABASE_URL: z.url(),
});
```

Validation runs synchronously (an async schema throws a clear error). See the
notes in the README on [bringing your own schema](../README.md#bring-your-own-schema-zod--valibot--arktype).

## Mixed built-ins and Standard Schema

Use whichever fits each field. Wrap a Standard Schema with `standard()` when you
want redaction or richer docs on it.

```ts
import { defineEnv, port, str, standard } from "prahari";
import { z } from "zod";

export const env = defineEnv({
  PORT: port().default(3000),                                   // built-in
  REGION: z.enum(["us", "eu"]),                                 // bare Zod
  SERVICE_NAME: str().desc("shown in traces"),                  // built-in
  API_KEY: standard(z.string().startsWith("sk_"), { secret: true }), // wrapped → redacted
});
```

## Next.js: server/client split

Keep server secrets out of the browser bundle; expose only `NEXT_PUBLIC_` vars.
Reading a server var on the client throws.

```ts
// env.ts
import { defineNextEnv } from "prahari/next";
import { str, url } from "prahari";

export const env = defineNextEnv({
  server: { DATABASE_URL: str(), STRIPE_SECRET_KEY: str().secret() },
  client: { NEXT_PUBLIC_API_URL: url() },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

Works with the App Router and the Pages Router. Full example:
[`examples/next/env.ts`](../examples/next/env.ts).

## Vite: server/client split

The same guard, wired to Vite's `VITE_` convention (`import.meta.env`).

```ts
// env.ts
import { defineViteEnv } from "prahari/vite";
import { str, url } from "prahari";

export const env = defineViteEnv({
  server: { DATABASE_URL: str(), SESSION_SECRET: str().secret() },
  client: { VITE_API_URL: url() },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    VITE_API_URL: import.meta.env.VITE_API_URL,
  },
  // isServer: import.meta.env.SSR,  // optional, for Vite SSR apps
});
```

Full example: [`examples/vite/env.ts`](../examples/vite/env.ts).

## Monorepo: share a base schema

`defineSchema` declares a base that each package extends. Later keys win, at
runtime and in the inferred type. `.extend()` returns a **new** schema — one
app's extension can never mutate what the others see.

```ts
// packages/config/base.ts
import { defineSchema, oneOf } from "prahari";

export const base = defineSchema({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  LOG_LEVEL: oneOf(["debug", "info", "warn", "error"]).default("info"),
});
```

```ts
// apps/api/env.ts
import { defineEnv, port, str } from "prahari";
import { base } from "@acme/config/base";

export const env = defineEnv(
  base.extend({
    PORT: port().default(3000),
    DATABASE_URL: str(),
  }),
);
// env.LOG_LEVEL -> "debug" | "info" | "warn" | "error"
// env.PORT      -> number
```

`.merge(other)` does the same with another schema (plain or composed), and both
verbs chain. Plain records still work everywhere a composed schema does —
`defineEnv({ ...base.fields, PORT: port() })` is equivalent.

See [composition.md](./composition.md) for the full picture.

## Test code that reads env

Pass an explicit `source` instead of touching `process.env` — no global state,
no cleanup.

```ts
import { defineEnv, port, str } from "prahari";

const env = defineEnv(
  { PORT: port(), NAME: str() },
  { source: { PORT: "8080", NAME: "svc" } }, // <- test fixture
);
expect(env.PORT).toBe(8080);
```

To assert on *invalid* config without try/catch, use `safeParse`:

```ts
import { safeParse, port } from "prahari";

const result = safeParse({ PORT: port() }, { source: { PORT: "not-a-port" } });
expect(result.success).toBe(false);
if (!result.success) {
  expect(result.error.failures[0].key).toBe("PORT");
}
```

## A bespoke type, without a schema library

`custom()` takes a function from the raw string to your type; throw to fail.
`.transform()` post-processes a built-in into a derived type.

```ts
import { defineEnv, custom, str } from "prahari";

export const env = defineEnv({
  // one-off validator — the whole thing, zero dependencies
  REGION: custom(
    (raw) => {
      if (!/^[a-z]{2}-[a-z]+-\d$/.test(raw)) throw new Error("must look like us-east-1");
      return raw;
    },
    { desc: "AWS region", example: "us-east-1" },
  ),
  // built-in first, then reshape — ORIGINS is string[]
  ORIGINS: str().transform((s) => s.split(",").map((o) => o.trim())).default([]),
});
```

The thrown message becomes that variable's row in the boot report, alongside
every other failure. See [extensibility.md](./extensibility.md).

## Edge runtimes (no `process.env`)

Cloudflare Workers and friends have no `process`. Pass the runtime's own
bindings as the `source` — prahari never reaches for `process.env` when you do.

```ts
import { defineEnv, str, url } from "prahari";

const schema = { API_TOKEN: str().secret(), UPSTREAM_URL: url() };

export default {
  fetch(request: Request, env: Record<string, string | undefined>) {
    const config = defineEnv(schema, { source: env }); // <- Workers bindings
    return fetch(config.UPSTREAM_URL, { headers: { authorization: config.API_TOKEN } });
  },
};
```

A source can also be anything with a synchronous `get(key)`. See
[sources.md](./sources.md).

## Required in production only

```ts
import { defineEnv, oneOf, str, url } from "prahari";

export const env = defineEnv({
  NODE_ENV:   oneOf(["development", "production", "test"]).default("development"),
  STRIPE_KEY: str().secret().requiredIn("production"),
  SENTRY_DSN: url().requiredWhen((env) => env.NODE_ENV !== "development"),
});
```

Missing it in production fails the boot with `is required when NODE_ENV is
production`; missing it locally is fine. The type is `string | undefined`, so the
compiler makes you handle the local case. Any other variable works as the
condition too — `.requiredWhen((env) => env.BILLING_ENABLED === true)`.

## Lists, durations and sizes

```ts
import { defineEnv, bytes, duration, list, port } from "prahari";

export const env = defineEnv({
  ORIGINS:    list().default([]),                    // "a.com,b.com" -> string[]
  PORTS:      list().of(port()).separator(";"),      // "80;443"      -> number[]
  TIMEOUT:    duration().default(30_000),            // "30s"         -> 30000 (ms)
  MAX_UPLOAD: bytes().default(10 * 1024 * 1024),     // "10mb"        -> 10485760
});
```

`list()` trims items and drops empty ones; an empty `ORIGINS=` is *unset*, so it
takes your default rather than silently becoming `[]`. A bad item names itself:
`item 2 ("abc") must be a number`. `duration()` returns milliseconds, `bytes()`
returns bytes, and both accept a bare number (ms / bytes) — with `kb`/`mb`/`gb`
as powers of 1024, the way config files mean them.

## Load a `.env` file yourself

```ts
import { defineEnv } from "prahari";
import { loadEnvFiles } from "prahari/env-file";

export const env = defineEnv(schema, {
  source: loadEnvFiles([".env.local", ".env"]),   // process.env still wins
});
```

Opt-in, in its own entry point so `node:fs` never reaches a browser bundle.
Node's `--env-file` and `dotenv` remain first-class alternatives — see
[env-files.md](./env-files.md) for the full stance.

## Keep `.env.example` honest in CI

Generate the template from the schema, then fail CI if it drifts.

```bash
prahari example        # write .env.example from your schema
prahari sync           # exit 1 if the schema and .env.example disagree
```

```yaml
# .github/workflows/ci.yml (excerpt)
- run: npx prahari sync   # a stale .env.example becomes a failing check
```

## Secrets and redaction

Mark a field `secret()` (built-in) or `standard(schema, { secret: true })`
(Standard Schema). A bad value is shown as `***` in the boot report and is left
blank in a generated `.env.example`.

```ts
import { defineEnv, str, standard } from "prahari";
import { z } from "zod";

export const env = defineEnv({
  STRIPE_KEY: str().secret().startsWith("sk_"),
  JWT_SECRET: standard(z.string().min(32), { secret: true }),
});
```

> A **bare** Standard Schema (`z.string()` with no `standard()` wrapper) carries
> no secret marker, so its invalid value is not redacted. Wrap it to redact.

## Defaults, optional, and the empty-string rule

- `.default(value)` takes an **already-typed** value: `port().default(3000)` is
  the number `3000`, not the string `"3000"`.
- `.optional()` widens the type to `T | undefined` and makes the var non-required.
- An explicitly empty env var (`FOO=`) counts as **unset** for the built-ins, so
  it flows through your default / optional / required rules instead of coercing
  to `""`. (A bare Standard Schema receives the raw value and decides for itself.)

```ts
import { defineEnv, str, port } from "prahari";

const env = defineEnv(
  { PORT: port().default(3000), TAG: str().optional() },
  { source: { PORT: "", TAG: "" } }, // both empty → treated as unset
);
env.PORT; // 3000 (default applied)
env.TAG;  // undefined
```
