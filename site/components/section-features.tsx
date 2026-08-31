import {
  ShieldCheck,
  Braces,
  Feather,
  Blocks,
  Terminal,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { features } from "@/lib/site";
import { SectionHeading } from "./ui";

const icons: Record<string, LucideIcon> = {
  ShieldCheck,
  Braces,
  Feather,
  Blocks,
  Terminal,
  EyeOff,
};

export function SectionFeatures() {
  return (
    <section id="features" className="border-t border-line/50 py-20 sm:py-24">
      <div className="container-content">
        <SectionHeading
          eyebrow="What you get"
          title="A guard, not just a validator"
          intro="Validation is table stakes. prahari also owns the parts everyone else leaves to you: the boot-time report, the type inference, and the tooling that keeps your docs from rotting."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = icons[f.icon] ?? ShieldCheck;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-line bg-surface/50 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-pass/30 hover:bg-surface"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-bg-soft text-pass transition-colors group-hover:border-pass/40">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <h3 className="font-mono text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
