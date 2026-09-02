# Composable schemas

One shared base schema, extended per package. Built for monorepos, useful
anywhere two entry points need overlapping-but-not-identical configuration.

```ts
import { defineSchema, defineEnv, oneOf, port, str } from "prahari";

// packages/config/base.ts — what every service needs
export const base = defineSchema({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  LOG_LEVEL: oneOf(["debug", "info", "warn", "error"]).default("info"),
});

// apps/api/env.ts — plus what this one needs
export const env = defineEnv(
  base.extend({
    PORT: port().default(3000),
    DATABASE_URL: str(),
  }),
);
```

`env` is typed as the union of both sets: `LOG_LEVEL` narrows to the enum,
`PORT` is a `number`, `DATABASE_URL` is a `string`.

## The three rules

**1. Later keys win** — at runtime and in the type. An app can tighten (or
loosen) a base variable by redeclaring it:

```ts
const strict = base.extend({
  LOG_LEVEL: oneOf(["warn", "error"]).default("warn"), // this app is noisy
});
// LOG_LEVEL is now "warn" | "error" — not a union with the base's four values
```

**2. Composition is immutable.** `.extend()` and `.merge()` return a *new*
schema; the base is untouched. Two apps extending the same base cannot see each
other's fields — which is the entire point of a shared base being safe to share.

**3. A composed schema goes anywhere a plain record goes** — `defineEnv`,
`safeParse`, `defineNextEnv`/`defineViteEnv`, and the CLI. The CLI sees the
flattened field record, so `prahari example`, `sync`, `docs` and `doctor` work on
a composed schema with nothing extra to configure.

## `extend` vs `merge`

```ts
base.extend({ PORT: port() });            // add fields inline
base.merge(otherComposedSchema);          // fold in another schema
base.merge({ PORT: port() });             // ...which may be a plain record
base.extend({ A: str() }).merge(shared);  // both chain
```

They do the same thing; `extend` reads better for literals, `merge` for
combining two named schemas.

## Reaching the raw fields

`.fields` is the flattened record, if you need to spread it or pass it to
something that wants a plain object:

```ts
const merged = { ...base.fields, PORT: port() };  // equivalent to base.extend
```

Plain records remain fully supported — `defineSchema` is an addition, not a
migration. Existing `defineEnv({ ... })` calls keep working unchanged.

## What is deliberately not here

No `.pick()`, `.omit()`, or `.partial()` in 1.0. Every one of them is additive
and non-breaking to add later, and none has a clear enough use in env config yet
to freeze an opinion about. If you need a subset today, `.fields` plus object
spread gets you there in one line.
