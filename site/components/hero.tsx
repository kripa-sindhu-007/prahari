import { ArrowRight, Github } from "lucide-react";
import { BootTerminal } from "./boot-terminal";
import { CopyCommand } from "./copy-command";
import { ButtonLink, Badge } from "./ui";
import { site } from "@/lib/site";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-veil opacity-60" aria-hidden />
      <div className="container-content relative grid gap-14 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:py-28">
        {/* Left — the pitch */}
        <div className="animate-fade-up">
          <div className="mb-5 flex items-center gap-3">
            <Badge tone="beam">
              <span className="font-sans">{site.devanagari}</span> · the sentinel
            </Badge>
            <span className="font-mono text-xs text-ink-muted">v{site.version}</span>
          </div>

          <h1 className="font-mono text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Type-safe environment
            <br />
            variables for TypeScript
          </h1>

          <p className="mt-5 font-mono text-xl font-semibold text-ink-soft sm:text-2xl">
            Bad config never <span className="text-pass">gets past the gate.</span>
          </p>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
              process.env.*
            </code>{" "}
            is a bag of untyped strings your app trusts blindly — so a bad deploy fails{" "}
            <span className="text-fail">later, in production</span>. prahari turns it into a typed,
            validated config that <span className="text-ink">crashes at boot</span> with a readable
            report — and a CLI that keeps your <code className="font-mono text-[0.9em]">.env.example</code>{" "}
            honest.
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <CopyCommand command={site.install} />
            <div className="flex items-center gap-3">
              <ButtonLink href={site.repo} external>
                <Github className="h-4 w-4" strokeWidth={2} />
                Star on GitHub
              </ButtonLink>
              <ButtonLink href="#problem" variant="ghost">
                See how
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </ButtonLink>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <Badge tone="pass">0 runtime deps</Badge>
            <Badge>ESM + CJS</Badge>
            <Badge>Node 18+</Badge>
            <Badge>MIT</Badge>
            <Badge>types included</Badge>
          </div>
        </div>

        {/* Right — the product doing its job */}
        <div className="animate-fade-up [animation-delay:120ms]">
          <BootTerminal />
          <p className="mt-4 text-center font-mono text-xs text-ink-muted">
            one schema · caught at boot · secrets redacted
          </p>
        </div>
      </div>
    </section>
  );
}
