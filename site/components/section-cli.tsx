import { CodeBlock } from "./code-block";
import { SectionHeading } from "./ui";
import { cliCommands } from "@/lib/site";

const envExample = `# Postgres connection string
# (required, string)
DATABASE_URL=

# (has default, port)
PORT=3000

# (required, secret, string)
STRIPE_KEY=
`;

export function SectionCli() {
  return (
    <section id="cli" className="border-t border-line/50 py-20 sm:py-24">
      <div className="container-content">
        <SectionHeading
          eyebrow="The CLI nobody else has"
          title="Your .env.example can never drift again"
          intro="The schema is the single source of truth. Generate the example file from it, and wire drift detection into CI so a stale template becomes a failing check — not a lost afternoon for the next person who clones the repo."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ul className="space-y-3">
            {cliCommands.map((c) => (
              <li
                key={c.cmd}
                className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface/50 p-4 transition-colors hover:border-beam/30"
              >
                <code className="font-mono text-sm text-pass">
                  <span className="text-ink-muted">$ </span>
                  {c.cmd}
                </code>
                <span className="text-sm text-ink-muted">{c.blurb}</span>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-muted">
              prahari example →
            </p>
            <CodeBlock code={envExample} label=".env.example" />
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Descriptions become comments. Types and flags are annotated. Run{" "}
              <code className="font-mono text-ink-soft">prahari sync</code> in CI and drift fails the
              build.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
