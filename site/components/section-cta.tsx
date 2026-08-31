import { Github } from "lucide-react";
import { CopyCommand } from "./copy-command";
import { ButtonLink } from "./ui";
import { Logo } from "./logo";
import { site } from "@/lib/site";

export function SectionCta() {
  return (
    <section className="border-t border-line/50 py-24">
      <div className="container-content">
        <div className="relative overflow-hidden rounded-3xl border border-pass/25 bg-surface/60 px-6 py-16 text-center shadow-passglow sm:px-12">
          <div className="pointer-events-none absolute inset-0 grid-veil opacity-40" aria-hidden />
          <div className="relative">
            <Logo className="mx-auto h-12 w-12" />
            <h2 className="mt-6 font-mono text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Put a sentinel on your config.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              Type-safe env, a boot-time report you can actually read, and a CLI that keeps your docs
              honest. Zero runtime dependencies. Ship it in minutes.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <CopyCommand command={site.install} />
              <ButtonLink href={site.repo} external>
                <Github className="h-4 w-4" strokeWidth={2} />
                Star on GitHub
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
