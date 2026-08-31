"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({
  command,
  className = "",
}: {
  command: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl border border-line-strong bg-surface-soft px-4 py-3 font-mono text-sm shadow-card ${className}`}
    >
      <span className="select-none text-pass" aria-hidden>
        $
      </span>
      <code className="text-ink">{command}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy install command"}
        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-beam/70"
      >
        {copied ? (
          <Check className="h-4 w-4 text-pass" strokeWidth={2.5} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
