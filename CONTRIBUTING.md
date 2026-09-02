# Contributing to prahari

Thanks for taking the time to contribute! prahari is a small, focused library
with a high bar for correctness — the guide below gets you set up and explains
how the project is tested and released so your change lands smoothly.

## Prerequisites

- **Node.js 22.13+** for development (the repo pins **pnpm 11** via
  [corepack](https://nodejs.org/api/corepack.html), which needs a recent Node).
  Published packages support **Node 18+** — that's the consumer floor, not the
  contributor one.
- **pnpm** — don't run `npm install`; it will fight the `pnpm-lock.yaml`. Enable
  corepack once and use `pnpm`:

```bash
corepack enable
corepack pnpm install
```

## Project layout

```
src/            # library source (zero runtime deps for the "." entry)
  index.ts        # public runtime entry
  core.ts         # defineEnv orchestrator
  validators.ts   # built-in validators + Standard Schema bridge
  adapter.ts      # shared server/client-boundary core
  next/ vite/     # framework adapters (prahari/next, prahari/vite)
  cli/            # the CLI (example / sync / doctor / docs)
test/           # tests (see the five layers below); test/types/*.test-d.ts are type-level
examples/       # runnable reference snippets (not published)
```

## The five layers of testing

A type-safe library ships bugs in two places the classic unit/integration/e2e
trio can't see — the **types** and the **published package** — so prahari tests
all five:

1. **Unit** — validators + the coercion matrix
2. **Integration** — `defineEnv` orchestration and the adapters
3. **Type-level** — `expectTypeOf` / `@ts-expect-error` (the inference *is* the product)
4. **E2E** — the real built `dist/cli.js` spawned against a fixture
5. **Packaging** — `publint` + `@arethetypeswrong/cli` (exports, ESM+CJS, and
   types resolve in every module mode, with no dependency leak)

```bash
corepack pnpm test          # unit + integration
corepack pnpm test:cov      # + coverage (97% threshold enforced on all metrics)
corepack pnpm test:types    # type-level
corepack pnpm test:package  # build + publint + attw
corepack pnpm test:all      # everything above
corepack pnpm typecheck     # tsc --noEmit
```

Run `test:all` before opening a PR. New behavior needs coverage in the relevant
layer(s) — a new validator wants unit + type-level tests; a new public type
wants a `*.test-d.ts`.

## Conventions

- **Zero runtime dependencies** for the `.` entry — the `import` must pull in
  nothing. Dev/test-only libraries (Zod, Valibot, ArkType, …) go in
  `devDependencies`. The CLI's single dependency is `jiti`.
- **Dual ESM + CJS** with correct types for both. New public entry points need a
  tsup entry, a `dts` entry, an `exports` block, and a `typesVersions` mapping
  (so legacy `node10` type resolution still finds the subpath).
- **TypeScript strict**, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
  Keep the public surface minimal and fully typed.
- Prefer clear error messages: prahari's whole value is failing loudly and
  legibly at boot.

## Branches, PRs, and review

- Work on a feature branch (`feature/…`, `fix/…`, `docs/…`); never push to
  `main` directly.
- Open a PR against `main`. `main` is branch-protected: CI (full suite +
  coverage on Node 22, and a compatibility smoke-test that installs the packed
  tarball on Node 18 / 20 / 22) must be green, and history is linear
  (squash-merge).
- Reference the issue you're closing (`Closes #NN`).

## Releasing (maintainers)

Merging never publishes — a **tag** does. Releases are batched:

1. Merge reviewed PRs to `main` (no tag). `main` accumulates unreleased commits.
2. When ready, bump `version` in `package.json` (and the `VERSION` constant in
   `src/index.ts`), add a `CHANGELOG.md` entry, and commit as `release: vX.Y.Z`.
3. Push a matching `vX.Y.Z` tag. `release.yml` verifies the tag equals the
   package version, runs the full suite, and publishes to npm via **Trusted
   Publishing (OIDC)** with provenance, then cuts a GitHub Release.

Follow [Semantic Versioning](https://semver.org/): a new adapter or validator is
a **minor**; a bug fix is a **patch**; a breaking change to the public API is a
**major**.

## Reporting bugs / requesting features

Open an [issue](https://github.com/kripa-sindhu-007/prahari/issues) with a
minimal reproduction (a schema + the input env + what you expected). For env
validation bugs, the exact `defineEnv` call and the raw values matter most.
