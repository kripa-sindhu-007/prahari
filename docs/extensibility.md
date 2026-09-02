# Custom types — `custom()` and `.transform()`

The built-ins cover what most services need, and any Standard Schema library
(Zod / Valibot / ArkType) covers the exotic cases. These two close the gap in
between: a bespoke type you want **without adding a dependency**.

## `custom()` — a validator from a function

```ts
import { defineEnv, custom } from "prahari";

export const env = defineEnv({
  REGION: custom(
    (raw) => {
      if (!/^[a-z]{2}-[a-z]+-\d$/.test(raw)) throw new Error("must look like us-east-1");
      return raw;
    },
    { desc: "AWS region", example: "us-east-1" },
  ),
});
// env.REGION -> string
```

The function receives the **present, non-empty** raw string — absence, defaults
and `.optional()` are handled before it runs, so you never have to check for
`undefined` or `""`.

Return the typed value; throw to fail. The thrown message becomes that
variable's reason in the aggregate report, next to every other failure:

```
✗ Invalid environment configuration

  REGION   must look like us-east-1   (received: "useast1", expected: custom)
```

A plain `throw new Error("…")` is enough — prahari converts it. Throwing
`EnvFieldError` explicitly works too, and is identical in effect.

### Metadata

```ts
custom(fn, {
  desc: "AWS region",      // shown in `prahari docs` and .env.example comments
  example: "us-east-1",    // placeholder written into .env.example
  secret: true,            // redact the value in the report ("***")
  typeName: "region",      // the label in reports and the docs table
});
```

All the shared modifiers work as usual:

```ts
custom(parseRegion).default("us-east-1")
custom(parseRegion).optional()
custom(parseRegion).desc("AWS region").secret()
```

## `.transform()` — reshape a built-in

When the *validation* is already covered by a built-in and you only want a
different shape at the end:

```ts
const env = defineEnv({
  ORIGINS: str().transform((s) => s.split(",").map((o) => o.trim())),
  TIMEOUT: num().int().min(0).transform((ms) => ({ ms, seconds: ms / 1000 })),
});
// env.ORIGINS -> string[]
// env.TIMEOUT -> { ms: number; seconds: number }
```

The transform runs **after** the inner coercion and after every check, so a
value that fails `.min(0)` never reaches your function.

### Ordering and defaults

`.transform()` returns a new validator typed at the result, so anything chained
after it is typed at the *transformed* type:

```ts
str().transform((s) => s.split(",")).default([])   // ✅ default is string[]
str().transform((s) => s.split(",")).default("")   // ❌ type error
```

A default declared **before** the transform is transformed once, eagerly, at
declaration — so the intent survives either ordering:

```ts
str().default("a,b").transform((s) => s.split(","))  // default is ["a", "b"]
```

If that default can't survive its own transform, you get a loud error where the
field is declared (not at boot, and not per-variable) — it is a bug in the
declaration, not in someone's `.env`.

`desc` and `secret` carry across a transform, because they describe the
variable rather than the type. The `.env.example` placeholder stays the **raw**
form, since that is what a user actually types:

```ts
str().default("a,b").transform((s) => s.split(","))
// .env.example  ->  VAR=a,b        (not ["a","b"])
```

## Which one?

| Situation | Reach for |
|---|---|
| A type no built-in covers | `custom()` |
| A built-in validates it, but you want a different shape | `.transform()` |
| Rich object/array schemas, unions, refinements you already write in Zod | [Standard Schema](../README.md#bring-your-own-schema-zod--valibot--arktype) |

A `standard()`-wrapped Standard Schema takes the same metadata as a built-in,
including deprecation:

```ts
OLD_REGION: standard(z.enum(["us", "eu"]), { deprecated: "use REGION", secret: false }),
```

`custom()` and `.transform()` keep the `.` entry **zero-dependency** — that's
what they exist for. If you already have Zod in the project, use Zod.
