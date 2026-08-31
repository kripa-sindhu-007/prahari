import { validators, modifiers } from "@/lib/site";
import { SectionHeading } from "./ui";

export function SectionValidators() {
  return (
    <section id="validators" className="border-t border-line/50 py-20 sm:py-24">
      <div className="container-content">
        <SectionHeading
          eyebrow="Built-in validators"
          title="Typed primitives, or bring your own"
          intro="Seven zero-dependency validators cover the everyday cases and infer exact types. Need more? Drop in any Standard Schema library instead."
        />

        <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-soft/60">
                  <th className="px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Validator
                  </th>
                  <th className="px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Inferred type
                  </th>
                  <th className="px-5 py-3.5 font-mono text-xs uppercase tracking-wider text-ink-muted">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {validators.map((v) => (
                  <tr
                    key={v.name}
                    className="border-b border-line/60 last:border-0 transition-colors hover:bg-surface/60"
                  >
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-sm text-pass">{v.name}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-sm text-[#82AAFF]">{v.type}</code>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-muted sm:text-sm">
                      {v.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-ink-muted">Shared modifiers:</span>
          {modifiers.map((m) => (
            <code
              key={m}
              className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-soft"
            >
              {m}
            </code>
          ))}
        </div>
      </div>
    </section>
  );
}
