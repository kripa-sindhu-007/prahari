import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    next: "src/next/index.ts",
    vite: "src/vite/index.ts",
    cli: "src/cli/index.ts",
  },
  format: ["esm", "cjs"],
  // Type declarations for the public runtime entries — the CLI has no public types.
  dts: {
    entry: {
      index: "src/index.ts",
      next: "src/next/index.ts",
      vite: "src/vite/index.ts",
    },
  },
  clean: true,
  sourcemap: true,
  target: "node18",
  splitting: false,
  // Preserve the shebang on the CLI entry so `dist/cli.js` is directly executable.
  banner: {},
});
