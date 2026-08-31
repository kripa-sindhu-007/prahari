"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";

type Phase = "typing" | "fail" | "pass";

const COMMAND = "node server.js";

function Chrome() {
  return (
    <div className="flex items-center gap-2 border-b border-line/70 bg-surface-soft px-4 py-3">
      <span className="flex gap-1.5" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-[#ff5f56]/80" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]/80" />
        <span className="h-3 w-3 rounded-full bg-[#27c93f]/80" />
      </span>
      <span className="ml-2 font-mono text-xs text-ink-muted">~/app — zsh</span>
    </div>
  );
}

function Prompt({ typed, cursor }: { typed: string; cursor: boolean }) {
  return (
    <div className="font-mono text-[13px] leading-relaxed sm:text-sm">
      <span className="text-pass">$</span>{" "}
      <span className="text-ink">{typed}</span>
      {cursor && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 bg-pass animate-cursor-blink" aria-hidden />}
    </div>
  );
}

function FailReport() {
  return (
    <div className="mt-3 font-mono text-[13px] leading-relaxed sm:text-sm">
      <div className="text-fail">
        <span className="font-semibold">prahari</span>: 2 environment variables failed validation
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-fail" strokeWidth={2.5} />
          <span>
            <span className="text-ink">DATABASE_URL</span>{" "}
            <span className="text-ink-muted">(string)</span>{" "}
            <span className="text-ink-soft">is required but was not set</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-fail" strokeWidth={2.5} />
          <span>
            <span className="text-ink">STRIPE_KEY</span>{" "}
            <span className="text-ink-muted">(secret)</span>{" "}
            <span className="text-ink-soft">must start with</span>{" "}
            <span className="text-[#C3E88D]">&quot;sk_&quot;</span>{" "}
            <span className="text-ink-muted">received: </span>
            <span className="text-warn">***</span>
          </span>
        </div>
      </div>
      <div className="mt-3 text-ink-muted">
        process exited before serving a single request.
      </div>
    </div>
  );
}

function PassReport() {
  return (
    <div className="mt-3 font-mono text-[13px] leading-relaxed sm:text-sm">
      <div className="flex items-center gap-2 text-pass">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        <span>
          <span className="font-semibold">prahari</span>: 6 / 6 environment variables validated
        </span>
      </div>
      <div className="mt-3 space-y-1 text-ink-soft">
        <div>
          <span className="text-ink-muted">›</span> config frozen &amp; type-safe
        </div>
        <div>
          <span className="text-ink-muted">›</span> server listening on{" "}
          <span className="text-beam">:3000</span>
        </div>
      </div>
      <div className="mt-3 text-pass-soft">ready — nothing got past the gate.</div>
    </div>
  );
}

export function BootTerminal() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");

  // Typewriter for the command, then cycle fail → pass forever.
  useEffect(() => {
    if (reduce) {
      setTyped(COMMAND);
      return;
    }
    let mounted = true;
    const timers: number[] = [];

    function runCycle() {
      if (!mounted) return;
      setPhase("typing");
      setTyped("");
      // type the command char by char
      COMMAND.split("").forEach((_, i) => {
        timers.push(
          window.setTimeout(() => {
            if (mounted) setTyped(COMMAND.slice(0, i + 1));
          }, 90 * (i + 1)),
        );
      });
      const afterType = 90 * COMMAND.length + 400;
      timers.push(window.setTimeout(() => mounted && setPhase("fail"), afterType));
      timers.push(window.setTimeout(() => mounted && setPhase("pass"), afterType + 3000));
      timers.push(window.setTimeout(runCycle, afterType + 6400));
    }

    runCycle();
    return () => {
      mounted = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [reduce]);

  // Reduced motion: show the whole story stacked, no animation.
  if (reduce) {
    return (
      <TerminalFrame>
        <Prompt typed={COMMAND} cursor={false} />
        <FailReport />
        <div className="my-4 border-t border-dashed border-line" />
        <Prompt typed={COMMAND} cursor={false} />
        <PassReport />
      </TerminalFrame>
    );
  }

  const tone =
    phase === "fail" ? "fail" : phase === "pass" ? "pass" : "neutral";

  return (
    <TerminalFrame tone={tone}>
      <Prompt typed={typed} cursor={phase === "typing"} />
      <div className="min-h-[168px]">
        <AnimatePresence mode="wait">
          {phase === "fail" && (
            <motion.div
              key="fail"
              initial={{ opacity: 0, rotateX: -8, y: 8 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 800 }}
            >
              <FailReport />
            </motion.div>
          )}
          {phase === "pass" && (
            <motion.div
              key="pass"
              initial={{ opacity: 0, rotateX: 8, y: 8 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 800 }}
            >
              <PassReport />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TerminalFrame>
  );
}

function TerminalFrame({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "fail" | "pass";
}) {
  const ring =
    tone === "fail"
      ? "border-fail/40 shadow-[0_0_60px_-18px_rgba(242,96,96,0.5)]"
      : tone === "pass"
      ? "border-pass/40 shadow-passglow"
      : "border-line-strong shadow-card";
  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border bg-surface/90 backdrop-blur transition-shadow duration-500 ${ring}`}
    >
      <Chrome />
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}
