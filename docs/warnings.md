# Warnings — deprecations and unknown variables

A warning is something worth saying that is **not** a failure. prahari has two.

## Deprecating a variable

```ts
export const env = defineEnv({
  API_URL:     url(),
  OLD_API_URL: url().deprecated("use API_URL instead").optional(),
});
```

```
prahari: OLD_API_URL is deprecated — use API_URL instead
```

The variable still validates exactly as before — a deprecation is a message to
the humans, not a failure. Two deliberate behaviours:

- **It only warns when the variable is actually set.** Warning about a deprecated
  variable nobody uses would just train people to ignore warnings.
- **An empty value counts as unset**, the same rule the validators use.

`prahari docs` and `.env.example` both mark the field, so the deprecation reaches
people reading the generated docs, not only people reading logs:

```
# DEPRECATED: use API_URL instead
# (optional, deprecated, url)
OLD_API_URL=
```

### Ordering

Metadata modifiers come **before** `.optional()`, which returns the plain
`Validator` interface:

```ts
str().deprecated("use NEW").optional()   // ✅
str().optional().deprecated("use NEW")   // ❌ type error
```

Same rule as `.transform()`.

## Unknown variables

Opt-in, because it is only meaningful against a source you control:

```ts
defineEnv(schema, { source: loadEnvFiles(".env"), unknown: "warn" });
```

```
prahari: STALE_KEY is set but not declared in the schema
```

- `"ignore"` (default) · `"warn"` · `"error"` — `"error"` turns unknowns into
  ordinary report failures (`is not declared in the schema`), so CI fails.
- **Do not point it at `process.env`.** It carries `PATH`, `HOME`, `SHELL` and a
  hundred others; every one of them would be "unknown". Point it at a loaded
  `.env` or an explicit record.
- A **`get(key)` source cannot be enumerated**, so the check is skipped for one.
  That is documented rather than silently half-working.

## Where warnings go

Straight to `console.warn`, one greppable line each:

```
prahari: OLD_API_URL is deprecated — use API_URL instead
```

That is stderr, so structured stdout logging is unaffected, and `defineEnv` runs
once at module scope — it is one line per process, not per request. Nothing is
emitted unless *you* wrote `.deprecated()` in your own schema or turned `unknown`
on, so prahari never warns uninvited.

Redirect or silence with `onWarn`:

```ts
defineEnv(schema, { onWarn: (w) => logger.warn({ key: w.key }, w.message) });
defineEnv(schema, { onWarn: () => {} });   // silence
```

`safeParse` also returns them, for tooling that would rather render warnings than
tail logs:

```ts
const result = safeParse(schema, { onWarn: () => {} });
result.warnings; // EnvWarning[] — on both the success and failure branches
```

```ts
interface EnvWarning {
  kind: "deprecated" | "unknown";
  key: string;
  message: string;
}
```

## In the CLI

```bash
prahari doctor                              # warnings appear as ! lines
prahari doctor --strict --env-file .env     # + unknown keys from that file
prahari doctor --json                       # warnings[] in the payload
```

`--strict` requires `--env-file` for the reason above: reporting "unknown"
against the process environment is noise, not signal. See
[ci.md](./ci.md) for wiring the JSON output into a pipeline.
