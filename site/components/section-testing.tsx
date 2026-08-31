import { testingLayers } from "@/lib/site";
import { SectionHeading } from "./ui";

export function SectionTesting() {
  return (
    <section className="border-t border-line/50 py-20 sm:py-24">
      <div className="container-content">
        <SectionHeading
          eyebrow="Tested in five layers"
          title="A type-safe library ships bugs in two places unit tests can't see"
          intro="The types and the published package. prahari tests both — inference with expectTypeOf, and the real tarball with publint + attw — on top of the usual unit, integration, and E2E."
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {testingLayers.map((l) => (
            <li
              key={l.n}
              className="rounded-2xl border border-line bg-surface/50 p-5"
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-pass/30 bg-pass-dim/40 font-mono text-sm font-semibold text-pass">
                {l.n}
              </div>
              <h3 className="font-mono text-sm font-semibold text-ink">{l.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{l.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center font-mono text-sm text-ink-muted">
          coverage <span className="text-pass">&gt; 95%</span> on statements, branches, functions
          &amp; lines — enforced.
        </p>
      </div>
    </section>
  );
}
