# Changelog

All notable changes to **prahari** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## Unreleased

The v1.0 core API surface. Everything here is **backward-compatible** — no
existing call signature changes, nothing is removed.

### Added
- **Composable schemas** (#5) — `defineSchema(fields)` returns a schema with
  `.extend(more)` and `.merge(other)`, for a shared base that each package
  extends. Later keys win at runtime and in the inferred type; composition is
  immutable, so one app's extension can't reach into another's. Composed schemas
  are accepted anywhere a plain record is: `defineEnv`, `safeParse`, the Next/Vite
  adapters, and the whole CLI. See `docs/composition.md`.
- **Pluggable value sources** (#6) — the `source` option is now a documented,
  stable contract: `EnvSource` is either a plain record or anything with a
  synchronous `get(key)`. prahari only ever asks for keys the schema declares, so
  a source never has to enumerate. See `docs/sources.md`, which also documents why
  resolution is synchronous and what an async source would cost.
- **`custom()` and `.transform()`** (#26) — zero-dependency extensibility.
  `custom(fn, meta?)` builds a validator from a plain function (throw to fail; the
  message becomes that variable's row in the report), and `.transform(fn)` on any
  built-in reshapes a validated value into a derived type, re-typing `.default()`
  and `.optional()` chained after it. See `docs/extensibility.md`.
- **`safeParse`** (#24) — the non-throwing variant, returning
  `{ success: true, data } | { success: false, error }`, for tests, health checks
  and tooling. Exported standalone and as `defineEnv.safeParse`; it shares one
  pipeline with `defineEnv`, so the two cannot drift.

### Fixed
- `defineEnv` no longer references `process.env` unguarded. On a runtime without
  a `process` binding (Cloudflare Workers, Deno Deploy) and no explicit `source`,
  it now produces the normal "is required but was not set" report instead of
  throwing `ReferenceError: process is not defined` — the runtime this feature
  exists to serve was the one it crashed on.

- **`list()`** (#23) — a delimited value into a typed array: `ORIGINS=a,b,c` →
  `string[]`. `.of(port())` validates and types each item (reporting *every* bad
  element, with its index), `.separator(";")` splits on something else, and
  `.min()/.max()` bound the item count. Items are trimmed and empty ones dropped;
  an empty variable stays *unset* rather than silently becoming `[]`.
- **`duration()` and `bytes()`** (#28) — `TIMEOUT=30s` → `30000` milliseconds,
  `MAX_UPLOAD=10mb` → `10485760` bytes. Both are plain `number`s and compose with
  `.int()/.min()/.max()`. `kb`/`mb`/`gb` are powers of **1024** (identical to
  `kib`/`mib`/`gib`) — the config-file convention, documented rather than assumed.
- **Conditional requirements** (#27) — `.requiredIn("production")` and
  `.requiredWhen((env) => …)` for a variable that is required only sometimes. The
  predicate runs after the rest of the environment resolves, so it can read other
  variables; the report says `is required when NODE_ENV is production`; the type
  widens to `T | undefined` because TypeScript cannot know the runtime
  environment. `prahari docs`, `.env.example` and `prahari doctor` all understand
  the condition and share one evaluator with `defineEnv`.
- **Opt-in `.env` loading** (#25) — `loadEnvFiles([".env.local", ".env"])` from the
  new **`prahari/env-file`** entry point, ready to hand to `source`. `process.env`
  wins over the files, earlier files win over later ones, empty counts as unset,
  and `process.env` is never mutated unless asked. It is a separate entry because
  it needs `node:fs`, which must never reach the main bundle. Also
  `prahari doctor --env-file <path>`. See `docs/env-files.md` for the stance:
  Node's `--env-file` and dotenv remain first-class alternatives.

- **Machine-readable CLI output** (#29) — `prahari doctor --json` and
  `prahari sync --json` print structured results with the same exit codes, for CI
  and tooling. Secrets stay redacted (`"received": "***"`) and an absent value is
  `null`, never the string `"undefined"`. Human output is unchanged without the
  flag. See `docs/ci.md`.
- **Deprecation warnings** (#30) — `.deprecated("use API_URL instead")` keeps
  validating the variable but warns when it is actually **set** (warning about one
  nobody uses only trains people to ignore warnings). `prahari docs` and
  `.env.example` mark the field too.
- **Unknown-variable detection** (#30) — opt-in `{ unknown: "warn" | "error" }` on
  `defineEnv`/`safeParse`, plus `prahari doctor --strict --env-file <path>`, which
  reports variables the file declares and the schema does not. `--strict` requires
  `--env-file`: run against `process.env` it would flag `PATH`, `HOME` and every
  other unrelated variable. Requires an enumerable source — a `get(key)` source
  cannot be listed, so the check is skipped for one.
- **Warning plumbing** — warnings go to `console.warn` as one `prahari: …` line
  (stderr, once per process at module scope); `onWarn` redirects or silences them,
  and `safeParse` now returns `warnings: EnvWarning[]` on both branches. Nothing is
  emitted unless the schema asked for it. See `docs/warnings.md`.

### Changed
- Coverage threshold raised from 95% to 97% on all four metrics.
- CI/release workflows: `actions/checkout`, `actions/setup-node`,
  `actions/upload-artifact` and `actions/download-artifact` bumped to `@v5` — the
  `@v4` line targets Node 20, which GitHub has deprecated on its runners.

## [0.3.0] - 2026-09-01

### Added
- **Next.js adapter** (`prahari/next`) — `defineNextEnv({ server, client, runtimeEnv })`
  enforces the server/client boundary: client keys must carry the `NEXT_PUBLIC_`
  prefix (configurable), server keys must not, and reading a server-only variable
  on the client throws instead of returning a silent `undefined`. Works with the
  App Router and the Pages Router.
- **Vite adapter** (`prahari/vite`) — `defineViteEnv({ server, client, runtimeEnv })`,
  the same boundary wired to Vite's `VITE_` convention (`import.meta.env`).
- Both adapters compose with the built-ins and any Standard Schema validator, and
  share one internal split/guard core.

### Changed
- Documentation: a recipes guide (`docs/recipes.md`) and a `CONTRIBUTING.md`,
  both linked from the README.
- Testing: snapshot coverage for the boot report / `.env.example` / docs table,
  and property-based (fast-check) coverage for the coercion invariants.
- Refreshed the package description and keywords to cover the schema-agnostic and
  framework-adapter capabilities.

The runtime stays **zero-dependency** (the new adapters add no runtime deps; the
extra libraries are test-only). Upgrading from `0.2.x` is backward-compatible.

## [0.2.0] - 2026-09-01

### Added
- **Standard Schema support** — `defineEnv` now accepts any
  [Standard Schema](https://standardschema.dev) validator (Zod, Valibot,
  ArkType, …), on its own or mixed with the built-ins, and infers the output
  type into the env object.
- **`standard(schema, { secret, desc, example })`** wrapper — attaches prahari
  metadata to a Standard Schema field so it is redacted in the boot report and
  rendered fully by `prahari example` / `prahari docs`.
- New exports: `standard`, `isStandardSchema`, and the types `StandardSchemaV1`,
  `StandardSchemaProps`, `StandardResult`, `StandardIssue`, `StandardMeta`,
  `EnvField`, `InferStandard`.
- An `examples/standard-schema.ts` example and a README section.

### Changed
- Standard Schema failures fold into the same aggregate boot report (tagged
  with the vendor); an async or malformed schema is surfaced as a clear
  synchronous error and never leaks a value.
- `prahari example` / `docs` render bare Standard Schema fields gracefully
  (vendor tag; `?` where prahari cannot read optionality).
- README no longer carries a roadmap — it reflects current, code-backed
  capabilities only.

The runtime stays **zero-dependency**: Zod / Valibot / ArkType are used only in
tests. Upgrading from `0.1.x` is backward-compatible — all existing built-in
validators and the CLI are unchanged.

## [0.1.2] - 2026-08-31

### Added
- A marketing homepage at **https://prahari-azure.vercel.app** (source in
  `site/`, Next.js, deployed on Vercel).

### Changed
- `homepage` now points to the site; added a website badge to the README.

No changes to the runtime, the public API, or the CLI. Upgrading from `0.1.1`
is a no-op for consumers.

## [0.1.1] - 2026-08-30

### Changed
- Releases now publish via npm **Trusted Publishing (OIDC)** instead of a
  long-lived automation token — provenance is generated from the workflow's
  OIDC identity, and no npm token is stored in the repository.

No changes to the runtime, the public API, or the CLI. Upgrading from `0.1.0`
is a no-op for consumers.

## [0.1.0] - 2026-08-30

Initial public release (published under the name `prahari`).

### Added
- `defineEnv` — validate `process.env` against a schema at boot, fail loudly
  with a readable report, and return a typed, frozen config object.
- Built-in validators: `str`, `num`, `port`, `bool`, `url`, `oneOf`, `json`,
  each with coercion, `.default()`, `.optional()`, and secret redaction.
- CLI (`prahari`): `example` (generate `.env.example`), `sync` (report schema↔env
  drift), `doctor` (validate the current environment), `docs` (Markdown table).
- Dual ESM + CJS build with split type definitions; zero runtime dependencies
  for the library entry point.

[0.1.2]: https://github.com/kripa-sindhu-007/prahari/releases/tag/v0.1.2
[0.1.1]: https://github.com/kripa-sindhu-007/prahari/releases/tag/v0.1.1
[0.1.0]: https://github.com/kripa-sindhu-007/prahari/releases/tag/v0.1.0
