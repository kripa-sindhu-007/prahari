import Link from "next/link";
import type { ReactNode } from "react";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  external = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  external?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none";
  const styles =
    variant === "primary"
      ? "bg-pass text-bg font-semibold shadow-passglow hover:bg-pass-soft hover:-translate-y-0.5"
      : "border border-line-strong bg-surface/60 text-ink-soft hover:border-beam/50 hover:text-ink hover:bg-surface-raised";
  const rel = external ? "noopener noreferrer" : undefined;
  const target = external ? "_blank" : undefined;
  return (
    <Link href={href} target={target} rel={rel} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "pass" | "beam";
}) {
  const tones = {
    neutral: "border-line-strong text-ink-muted",
    pass: "border-pass/40 text-pass-soft",
    beam: "border-beam/40 text-beam",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${tones[tone]} bg-surface/50 px-3 py-1 font-mono text-xs`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "left" | "center";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {eyebrow && (
        <div
          className={`mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-beam ${
            align === "center" ? "justify-center" : ""
          }`}
        >
          <span className="h-px w-6 bg-beam/50" aria-hidden />
          {eyebrow}
        </div>
      )}
      <h2 className="font-mono text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-base leading-relaxed text-ink-muted">{intro}</p>}
    </div>
  );
}
