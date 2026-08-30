# Changelog

All notable changes to **prahari** are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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

[0.1.1]: https://github.com/kripa-sindhu-007/prahari/releases/tag/v0.1.1
[0.1.0]: https://github.com/kripa-sindhu-007/prahari/releases/tag/v0.1.0
