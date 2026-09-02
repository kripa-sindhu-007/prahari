# API reference

The complete public surface, frozen at 1.0. Adding to it is a minor release;
removing or renaming anything in it is a major one. A test
(`test/public-api.test.ts`) pins this list, so a rename shows up as a failing
diff here rather than as a broken import in your build.

Four entry points:

| Import | What lives there |
|---|---|
| `prahari` | everything below — zero runtime dependencies, runs anywhere |
| `prahari/next` | the Next.js server/client boundary |
| `prahari/vite` | the same, for Vite |
| `prahari/env-file` | opt-in `.env` loading (uses `node:fs`, so it is deliberately not in the main entry) |

---

## `prahari`

### Orchestrators

#### `defineEnv(schema, options?)`
Validates and returns a frozen, fully-typed object. Throws `EnvValidationError`
listing **every** failure at once. `schema` is a plain record or a
`ComposedSchema`.

#### `defineEnv.safeParse(schema, options?)` · `safeParse(schema, options?)`
The same pipeline without throwing:
```ts
{ success: true;  data: Readonly<InferEnv<S>>; warnings: EnvWarning[] }
{ success: false; error: EnvValidationError;   warnings: EnvWarning[] }
```
Both names are the same function. A genuine bug inside a validator still
propagates — that is not a configuration failure.

#### `defineSchema(fields)`
A reusable schema with `.extend(more)`, `.merge(other)` and `.fields`.
Immutable; later keys win. See [composition.md](./composition.md).

### `DefineEnvOptions`

| Option | Type | Default | Notes |
|---|---|---|---|
| `source` | `EnvSource` | `process.env`, or `{}` on a runtime without one | [sources.md](./sources.md) |
| `onWarn` | `(w: EnvWarning) => void` | one `prahari: …` line on `console.warn` | [warnings.md](./warnings.md) |
| `unknown` | `"ignore" \| "warn" \| "error"` | `"ignore"` | needs an enumerable source |

### Validators

| Factory | Type | Notes |
|---|---|---|
| `str()` | `string` | `.min` `.max` `.startsWith` `.matches` |
| `num()` | `number` | `.int` `.min` `.max` |
| `port()` | `number` | integer 1–65535 |
| `bool()` | `boolean` | `1\|true\|yes\|on` / `0\|false\|no\|off` |
| `url()` | `string` | valid URL; `.protocol("https")` |
| `oneOf([...])` | literal union | narrows the type |
| `json<T>()` | `T` | `JSON.parse` |
| `list()` | `string[]` | `.of(inner)` `.separator(s)` `.min` `.max` (item count) |
| `duration()` | `number` (ms) | `30s` `500ms` `2h` `1d`; bare number = ms |
| `bytes()` | `number` (bytes) | `10mb` `64kb`; **1 kb = 1024**; bare number = bytes |
| `custom<T>(fn, meta?)` | `T` | your function; throw to fail |
| `standard(schema, meta?)` | schema's output | wraps a Standard Schema to add prahari metadata |

### Shared modifiers

`.default(value)` · `.desc(text)` · `.secret()` · `.deprecated(message?)` ·
`.transform(fn)` · `.requiredWhen(predicate, label?)` · `.requiredIn(...envs)` ·
`.optional()`

**Chaining rules** — three, and they all come from the same cause: a modifier that
changes the field's *type* has to return a new validator, so anything typed
against the old one must come first.

1. `.of()` before everything else on a `list()` — it re-types the items.
2. `.transform()` before `.default()`/`.optional()` — those are then typed at the
   transformed type. (A `.default()` declared *before* a transform is transformed
   once, eagerly, at declaration.)
3. Metadata modifiers (`.desc`, `.secret`, `.deprecated`) before `.optional()` /
   `.requiredWhen()` / `.requiredIn()`, which close the chain by returning the
   plain `Validator` interface.

Each is enforced at compile time, and `.of()` also throws a message naming the fix.

### Errors

#### `EnvValidationError`
Thrown by `defineEnv`, returned by `safeParse`. `message` is the formatted
report; `failures: FieldFailure[]` is the structured form:

```ts
interface FieldFailure {
  key: string;       // the variable
  reason: string;    // "must be a number", "is required when NODE_ENV is production"
  received: string | undefined;  // already redacted for secret() fields
  expected: string;  // the type name
}
```

```ts
try {
  defineEnv(schema);
} catch (err) {
  if (err instanceof EnvValidationError) {
    for (const f of err.failures) report(f.key, f.reason);
  }
  throw err;
}
```

#### `EnvFieldError`
Thrown by a single validator; `message` is a fragment (`"must be a number"`) that
the core prefixes with the variable name. Throw it from `custom()` when you want
to be explicit — any `Error` works.

#### `isEnvFieldError(err)`
Brand check that survives the bundle boundary. The runtime and the CLI are
separate bundles, so a plain `instanceof` can fail across them; this checks the
stable `name`. Prefer it over `instanceof` if you handle errors from both.

### Type guards

- `isStandardSchema(x)` — is this a Zod/Valibot/ArkType (Standard Schema) validator?
- `isComposedSchema(x)` — is this a `defineSchema(...)` result rather than a plain record?

Both are exported for tooling that walks a schema; neither is needed for ordinary use.

### `VERSION`

The package version as a string constant, kept in step with `package.json` by a
test.

### Exported types

`Validator` · `ValidatorMeta` · `EnvField` · `EnvSchema` · `Infer` · `InferEnv` ·
`DerivedValidator` · `CustomMeta` · `ConditionalRequirement` · `EnvSource` ·
`EnvWarning` · `UnknownPolicy` · `SafeParseResult` · `DefineEnvOptions` ·
`FieldFailure` · `ComposedSchema` · `MergeSchemas` · `SchemaInput` ·
`StandardSchemaV1` · `StandardSchemaProps` · `StandardResult` · `StandardIssue` ·
`StandardMeta` · `InferStandard`

---

## `prahari/next` · `prahari/vite`

```ts
defineNextEnv({ server, client, runtimeEnv, clientPrefix?, isServer? })
defineViteEnv({ server, client, runtimeEnv, clientPrefix?, isServer? })
```
Types: `DefineNextEnvOptions`, `DefineViteEnvOptions`. `server`/`client` accept a
plain record or a `ComposedSchema`. Reading a server-only variable on the client
throws instead of returning `undefined`. See the README.

---

## `prahari/env-file`

```ts
loadEnvFiles(files: string | string[], options?): Record<string, string | undefined>
parseEnvFile(text: string): EnvFileValues
```

`loadEnvFiles` reads files and returns a source ready for `defineEnv`.
`parseEnvFile` is the parser on its own, for when you already have the text (a
secret manager's blob, a fixture in a test).

Options: `cwd` · `base` · `override` · `mutateProcessEnv`. Types:
`LoadEnvFilesOptions`, `EnvFileValues`. Full behaviour and the loading stance:
[env-files.md](./env-files.md).

---

## The CLI

```
prahari example    generate .env.example from the schema
prahari sync       report drift between the schema and an env file
prahari doctor     validate the current environment
prahari docs       print a Markdown table of every variable
```

| Flag | Applies to | Notes |
|---|---|---|
| `-c, --config <path>` | all | default: `env.ts` / `src/env.ts` / … |
| `-f, --file <path>` | `sync` | default `.env.example` |
| `-o, --out <path>` | `example`, `docs` | |
| `--stdout` | `example` | print instead of writing |
| `--env-file <path>` | `doctor` | real environment still wins |
| `--json` | `doctor`, `sync` | same exit codes; see [ci.md](./ci.md) |
| `--strict` | `doctor` | unknown keys in the env file; requires `--env-file` |

Exit code 1 on drift or invalid config; 0 otherwise.

---

## Stability

- **Frozen at 1.0:** everything above.
- **Not public** (may change without notice): anything under `src/` not re-exported
  from an entry point — `describeField`, the CLI's internal renderers, the schema
  registry.
- **Deliberately deferred past 1.0:** async value sources (see
  [sources.md](./sources.md#why-not-async-yet)), `.pick()`/`.omit()`/`.partial()`
  on composed schemas, and further framework adapters. All additive when they land.
