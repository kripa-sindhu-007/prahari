import { ArrowRight } from "lucide-react";
import { CodeBlock } from "./code-block";
import { SectionHeading } from "./ui";

const before = `// scattered, untyped, unvalidated — trusts strings blindly
const port = Number(process.env.PORT) || 3000;
const url  = process.env.DATABASE_URL!;        // "!" = trust me
if (process.env.DEBUG === "true") { /* ... */ } // "false" is truthy…
// a missing var is silently undefined → it crashes later, in prod
`;

const after = `// env.ts — validated ONCE, at boot
import { defineEnv, str, port, bool, oneOf } from "prahari";

export const env = defineEnv({
  NODE_ENV: oneOf(["development", "production", "test"]).default("development"),
  PORT: port().default(3000),
  DATABASE_URL: str().desc("Postgres connection string"),
  STRIPE_KEY: str().secret().startsWith("sk_"),
  DEBUG: bool().default(false),
});

env.PORT;      // number
env.NODE_ENV;  // "development" | "production" | "test"
env.DEBUG;     // boolean
`;

export function SectionProblem() {
  return (
    <section id="problem" className="border-t border-line/50 py-20 sm:py-24">
      <div className="container-content">
        <SectionHeading
          eyebrow="Before / after"
          title="From “trust me” to proven at startup"
          intro="Same five variables. One version guesses and hopes; the other validates once, hands you typed values, and refuses to boot when something's wrong."
        />

        <div className="mt-12 grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-fail">
              <span className="h-1.5 w-1.5 rounded-full bg-fail" /> before
            </div>
            <CodeBlock code={before} tone="fail" label="server.ts" />
          </div>

          <div className="mx-auto hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-beam lg:flex">
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-pass">
              <span className="h-1.5 w-1.5 rounded-full bg-pass" /> after
            </div>
            <CodeBlock code={after} tone="pass" label="env.ts" />
          </div>
        </div>
      </div>
    </section>
  );
}
