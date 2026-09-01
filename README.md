# prahari

*प्रहरी — "the sentinel." It stands watch over your environment config and refuses to let a misconfigured process past the gate.*

[![website](https://img.shields.io/badge/website-prahari-22C55E.svg)](https://prahari-azure.vercel.app)
[![CI](https://github.com/kripa-sindhu-007/prahari/actions/workflows/ci.yml/badge.svg)](https://github.com/kripa-sindhu-007/prahari/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/prahari.svg)](https://www.npmjs.com/package/prahari)
[![coverage](https://img.shields.io/badge/coverage-%3E95%25-brightgreen.svg)](#testing)
[![types](https://img.shields.io/badge/types-included-blue.svg)](#)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Type-safe, self-documenting environment variables for TypeScript — fail loudly at boot, and never let your `.env.example` drift from reality.

`process.env.*` is a bag of untyped, unvalidated strings your app trusts blindly — so a
misconfigured deploy doesn't fail when you ship it, it fails **later, in production**, far
from the cause. **prahari** turns those strings into a typed, validated, frozen config that
crashes at startup with a readable report — and gives you a CLI that keeps your
`.env.example` and docs honest automatically.

- **Type-safe** — `port()` → `number`, `oneOf([...])` → a literal union, all inferred.
- **Fails at boot, not in prod** — one readable table of everything that's wrong.
- **Zero runtime dependencies** — the `import` pulls in nothing.
- **Schema-agnostic** — bring your own [Standard Schema](https://standardschema.dev) validator (Zod/Valibot/ArkType) *or* use the built-ins.
- **A CLI nobody else has** — `example`, `sync`, `doctor`: your `.env.example` can't drift.

---

## Before / after

```ts
// ❌ before — scattered, untyped, unvalidated, trusts strings blindly
const port = Number(process.env.PORT) || 3000;
const url  = process.env.DATABASE_URL!;        // "!" = trust me
if (process.env.DEBUG === "true") { /* ... */ } // "false" is a truthy string…
// a missing var is silently `undefined` → it crashes later, in prod
```

```ts
// ✅ after — validated ONCE, at boot
// env.ts
import { defineEnv, str, port, bool, oneOf } from "prahari";

export const env = defineEnv({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  PORT: port().default(3000),
  DATABASE_URL: str().desc("Postgres connection string"),
  STRIPE_KEY: str().secret().startsWith("sk_"),
  DEBUG: bool().default(false),
});

env.PORT;        // number
env.NODE_ENV;    // "development" | "production" | "test"
env.DEBUG;       // boolean
```

If something's missing or malformed, the process **refuses to start** and tells you exactly why:

```
prahari: 2 environment variables failed validation

  ✗ DATABASE_URL  (string)  is required but was not set
  ✗ STRIPE_KEY    (string)  must start with "sk_"   received: ***
```

Secrets are redacted (`received: ***`) — a bad value never leaks into your logs.

---

## Install

```bash
npm i prahari      # or: pnpm add prahari
```

Requires Node 18+. Ships ESM + CJS with correct types for both.

---

## The CLI — your `.env.example` can never drift again

```bash
prahari example    # generate .env.example from your schema (descriptions → comments)
prahari sync       # report drift between your schema and .env.example (exit 1 on drift)
prahari doctor     # validate the current environment, red/green per variable
prahari docs       # print a Markdown table of your variables (paste into your README)
```

`prahari example` produces a documented template straight from your schema:

```dotenv
# Postgres connection string
# (required, string)
DATABASE_URL=

# (has default, port)
PORT=3000

# (required, secret, string)
STRIPE_KEY=
```

Wire `prahari sync` into CI and a stale example file becomes a failing check, not a
lost afternoon for the next person who clones the repo.

---

## Validators

| Validator | Type | Notes |
|---|---|---|
| `str()` | `string` | `.min` `.max` `.startsWith` `.matches` |
| `num()` | `number` | `.int` `.min` `.max` |
| `port()` | `number` | integer, 1–65535 |
| `bool()` | `boolean` | `1\|true\|yes\|on` / `0\|false\|no\|off` (else error) |
| `url()` | `string` | valid URL, `.protocol("https")` |
| `oneOf([...])` | union | narrows to the literal union |
| `json<T>()` | `T` | `JSON.parse` |

Shared modifiers: `.default(value)` · `.optional()` · `.desc(text)` · `.secret()`.

**Defaults are typed values, not re-parsed strings** — `.default(3000)` is the number `3000`,
full stop. And an explicitly empty env var (`FOO=`) counts as **unset**, so it flows through
your default / optional / required rules rather than silently coercing.

---

## Bring your own schema (Zod / Valibot / ArkType)

Already validate with Zod, Valibot, or ArkType? Use them directly — anything that implements
[Standard Schema](https://standardschema.dev) works as a field, on its own or mixed with the
built-ins. One schema library across your app; the built-ins remain the zero-dependency on-ramp.

```ts
import { defineEnv, port, standard } from "prahari";
import { z } from "zod";

export const env = defineEnv({
  PORT: port().default(3000),          // built-in
  REGION: z.enum(["us", "eu"]),        // bare Zod — inferred as "us" | "eu"
  DATABASE_URL: z.url(),               // bare Zod
  API_KEY: standard(z.string().startsWith("sk_"), { secret: true }), // wrapped → redacted
});
```

Failures land in the same boot report as the built-ins; the output type is inferred from your
schema. Two things worth knowing:

- **Synchronous only.** `defineEnv` runs at import time, so an async schema (e.g. Zod's
  `.refine(async …)`) throws a clear error instead of returning a promise. Env validation is
  synchronous by design.
- **Bare schemas carry no prahari metadata.** A raw `z.string()` can't tell prahari it's a
  secret, or supply a `.env.example` placeholder — Standard Schema exposes no static
  optional/default info. Wrap it with `standard(schema, { secret, desc, example })` when you
  want redaction or richer `example` / `docs` output. Everything still *validates* either way.

A runnable example lives in [`examples/standard-schema.ts`](examples/standard-schema.ts).

---

## Testing

prahari is tested in **five layers**, because a type-safe library ships bugs in two places
the classic unit/integration/e2e trio can't see — the *types* and the *published package*:

1. **Unit** — validators + the coercion matrix
2. **Integration** — `defineEnv` orchestration
3. **Type-level** — `expectTypeOf` + `@ts-expect-error` (the inference *is* the product)
4. **E2E** — the real `dist/cli.js` spawned against a fixture
5. **Packaging** — `publint` + `@arethetypeswrong/cli` (exports/ESM+CJS/types resolve, no dep leak)

```bash
pnpm test          # unit + integration
pnpm test:cov      # + coverage (95% threshold enforced)
pnpm test:types    # type-level
pnpm test:package  # publint + attw
pnpm test:all      # everything
```

Coverage sits above 95% on statements, branches, functions, and lines.

---

## What it isn't

Not a secrets manager (it validates what's in the environment; it doesn't fetch from
Vault/Doppler). Validation runs at boot, not on hot-reload.

## License

MIT
