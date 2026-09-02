# prahari in CI

Three checks, all exit-code driven, all machine-readable with `--json`.

| Command | Fails when | Exit |
|---|---|---|
| `prahari sync` | `.env.example` has drifted from the schema | 1 |
| `prahari doctor` | the current environment is invalid | 1 |
| `prahari doctor --strict --env-file .env` | …plus the file declares variables the schema doesn't | 1 (invalid only — unknowns are warnings) |

## Drift: the template can never go stale

```yaml
# .github/workflows/ci.yml
- name: Check .env.example is in sync with the schema
  run: npx prahari sync
```

That is the check that pays for itself: nobody adds a variable and forgets to
update `.env.example`, because the build says so.

## Validating a real environment

```yaml
- name: Validate production config
  run: npx prahari doctor
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    STRIPE_KEY: ${{ secrets.STRIPE_KEY }}
    NODE_ENV: production
```

`NODE_ENV: production` matters: variables declared `.requiredIn("production")`
are only enforced when the condition holds, so this checks the *production*
contract, not the local one.

## Machine-readable output

`--json` prints structured results to stdout and keeps the same exit codes.

```bash
prahari doctor --json
```
```jsonc
{
  "ok": false,
  "variables": [
    { "key": "PORT", "status": "ok" },
    { "key": "DATABASE_URL", "status": "invalid",
      "reason": "is required but was not set",
      "expected": "string", "received": null }
  ],
  "warnings": [
    { "kind": "deprecated", "key": "OLD_URL", "message": "OLD_URL is deprecated — use DATABASE_URL" }
  ]
}
```

```bash
prahari sync --json
```
```jsonc
{ "ok": false, "file": ".env.example", "missing": ["NEW_VAR"], "unknown": ["STALE_VAR"] }
```

Secrets stay redacted in JSON exactly as in the human report — a `secret()` field
reports `"received": "***"`. A value that is absent — or explicitly empty, which
prahari treats the same way — is `null`, never the string `"undefined"` and never
`""`, so a `jq` pipeline needs no special case.

### Building a job summary

```bash
prahari doctor --json > result.json || true
jq -r '.variables[] | select(.status=="invalid") | "- `\(.key)` — \(.reason)"' result.json \
  >> "$GITHUB_STEP_SUMMARY"
exit "$(jq -r 'if .ok then 0 else 1 end' result.json)"
```

## Catching stale variables

```bash
prahari doctor --strict --env-file .env
```

Reports keys in that file which the schema no longer declares — the other half of
the drift story, this time about values rather than the template. It requires
`--env-file`: run against the process environment it would flag `PATH`, `HOME`
and everything else the runner sets.

Unknown keys are **warnings**, so they do not fail the build on their own. To
make them fatal, do it at the source in your config:

```ts
defineEnv(schema, { source: loadEnvFiles(".env"), unknown: "error" });
```
