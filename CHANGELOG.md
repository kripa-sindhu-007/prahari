# Changelog

All notable changes to **prahari** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
