#!/usr/bin/env node
/**
 * envguard CLI bin — a thin wrapper around `run` (in `run.ts`), which holds all
 * the testable routing/command logic.
 */

import { run } from "./run.js";

run(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`${(err as Error)?.stack ?? String(err)}\n`);
    process.exitCode = 1;
  });
