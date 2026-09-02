# Value sources

Where prahari reads raw values from. This is a **stable extension point** — the
contract below is part of the 1.0 API and will not change under you.

```ts
export type EnvSource =
  | Record<string, string | undefined>
  | { get(key: string): string | undefined };
```

Pass one as `source`:

```ts
defineEnv(schema);                      // process.env (the default)
defineEnv(schema, { source: myRecord }); // a plain record
defineEnv(schema, { source: myStore });  // anything with get(key)
```

Two guarantees the contract gives you:

- **prahari only asks for keys your schema declares.** A source never has to
  enumerate, list, or support iteration — implement `get(key)` and you are done.
- **Reads are synchronous.** See [Why not async](#why-not-async-yet) below.

## The default source

With no `source`, prahari reads `process.env` — and on a runtime that has no
`process` binding at all, it reads from an empty source instead of crashing.
That matters: a bare `process.env` reference on Cloudflare Workers throws
`ReferenceError: process is not defined`, which tells you nothing about your
config. You get the normal report instead:

```
✗ Invalid environment configuration

  API_TOKEN   is required but was not set   (expected: string)
```

## Edge runtimes

Workers-style runtimes hand you the bindings as an argument. Pass them straight
through:

```ts
import { defineEnv, str, url } from "prahari";

const schema = { API_TOKEN: str().secret(), UPSTREAM_URL: url() };

export default {
  fetch(request: Request, env: Record<string, string | undefined>) {
    const config = defineEnv(schema, { source: env });
    return fetch(config.UPSTREAM_URL, { headers: { authorization: config.API_TOKEN } });
  },
};
```

Note that this validates **per request**, not at boot — the bindings do not
exist before the first invocation. If you want the boot-time guarantee on an
edge runtime, validate at module scope with whatever your platform exposes
there, or cache the result:

```ts
let config: ReturnType<typeof buildConfig> | undefined;
const buildConfig = (env: Record<string, string | undefined>) =>
  defineEnv(schema, { source: env });

export default {
  fetch(request: Request, env: Record<string, string | undefined>) {
    config ??= buildConfig(env); // validate once per isolate
    // ...
  },
};
```

## A `get(key)` source

Anything with a synchronous `get` works — a `Map`, a config object, an in-memory
store, a thin wrapper over a secret cache you have already populated:

```ts
const secrets = new Map([["STRIPE_KEY", "sk_live_123"]]);
defineEnv({ STRIPE_KEY: str().secret() }, { source: secrets });
```

```ts
const layered = {
  get: (key: string) => overrides[key] ?? process.env[key],
};
defineEnv(schema, { source: layered }); // per-key precedence, your rules
```

A plain record that happens to have a `"get"` **variable** is still treated as a
record — prahari only takes the getter path when `get` is a function.

## Testing

An explicit source is the cleanest way to test config-dependent code: no global
mutation, no cleanup, no cross-test leakage.

```ts
const env = defineEnv(schema, { source: { PORT: "8080", NAME: "svc" } });
```

Pair it with [`safeParse`](../README.md#safeparse) when you want to assert on
invalid configuration without a try/catch.

## Why not async (yet)

Secret managers (Vault, Doppler, AWS Secrets Manager) resolve over the network,
which would make a source `async` — and that would make `defineEnv` async, and
therefore your entire entry point.

That trade is the whole reason prahari is synchronous: `defineEnv` runs at module
scope so the process **fails at boot**, before a single request is served. An
awaited env means the module can't export a validated object, so every consumer
becomes a promise, and the failure moves from startup into your first request.

So async resolution is deliberately not in 1.0. The intended shape for 1.x is a
separate entry point (`defineEnvAsync`) that keeps this synchronous one intact —
the `EnvSource` contract above is the boundary it will build on. Meanwhile, the
supported pattern is to resolve secrets **before** validating:

```ts
const secrets = await vault.read("secret/data/api"); // your code, your await
export const env = defineEnv(schema, { source: { ...process.env, ...secrets } });
```

Sourcing secrets from external managers is explicitly out of scope for the core;
this contract is only the pluggable input boundary.
