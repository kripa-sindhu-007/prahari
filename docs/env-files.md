# `.env` files — the stance, and the opt-in loader

## The stance

**prahari validates the environment. It does not load it — unless you ask.**

Something has to read `.env` into the process, and by 2026 three good options
already exist:

| Option | When it fits |
|---|---|
| **Node's `--env-file`** | Node ≥ 20.6. No dependency at all: `node --env-file=.env server.js` |
| **`dotenv`** | You already use it, or you want its ecosystem (dotenv-vault, expansion) |
| **Your platform** | Vercel/Railway/Fly/Docker inject real environment variables; there is no file to load |

prahari works with all three, because it validates whatever ended up in the
environment and does not care how it got there. That is the point: loading and
validating are different jobs, and coupling them is why "it works locally"
happens.

The loader below exists so that you don't *need* a second tool for the simple
case — not because you should stop using the one you have.

## The opt-in loader

```ts
import { defineEnv, port, str } from "prahari";
import { loadEnvFiles } from "prahari/env-file";

export const env = defineEnv(
  { PORT: port().default(3000), DATABASE_URL: str() },
  { source: loadEnvFiles([".env.local", ".env"]) },
);
```

It lives at `prahari/env-file`, **not** in the main entry, on purpose: it uses
`node:fs`, and `node:fs` in the main bundle would break prahari in a browser, on
Cloudflare Workers, and in any bundler that resolves the `.` entry for the client.
Importing this module is the opt-in — the core stays zero-dependency and
runtime-agnostic.

### Precedence

Highest wins:

1. The real environment (`process.env`)
2. Each file, **in the order you list them** — `[".env.local", ".env"]` means
   `.env.local` beats `.env`, which is how everyone writes it

A value that is present-but-empty in the environment counts as *unset* — the same
rule prahari's validators use — so an empty `PORT=` in your shell does not mask
the `PORT` in your file.

```ts
loadEnvFiles(".env", { override: true });   // file beats process.env instead
```

### Options

```ts
loadEnvFiles(files, {
  cwd,               // where relative paths resolve (default: process.cwd())
  base,              // what the files fill in around (default: process.env)
  override,          // let files win over `base` (default: false)
  mutateProcessEnv,  // also write into process.env (default: false)
});
```

`mutateProcessEnv` is off by default. A pure return value is easier to test and
to reason about, and third-party code that reads `process.env` directly is
usually the thing you are trying to get away from. Turn it on when you have a
dependency that insists.

### Missing files

A missing file is skipped silently — `[".env.local", ".env"]` where only `.env`
exists is the normal case, not an error. A file that exists but cannot be read
(a directory, a permissions problem) still throws: that one is a real mistake.

## Supported syntax

```bash
# a comment
KEY=value
export KEY=value                # `export ` prefix is ignored
QUOTED="  keeps whitespace  "
SINGLE='no \n escapes here'
DOUBLE="tab\there and a newline\n"
HASH="a # inside quotes is literal"
PLAIN=value  # a trailing comment on an unquoted value is stripped
MULTILINE="-----BEGIN KEY-----
line two
-----END KEY-----"
```

CRLF files and a leading BOM are handled. An unquoted `#` starts a comment, so
quote any value that contains one (`URL="https://x/#frag"`).

## In the CLI

`prahari doctor` can validate a file the same way:

```bash
prahari doctor --env-file .env
```

The real environment still wins over the file, so what you see is what the
process would actually get if it booted right there.
