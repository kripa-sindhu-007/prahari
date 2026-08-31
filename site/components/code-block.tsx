import { Fragment } from "react";

type Token = { text: string; cls: string };

const KEYWORDS = new Set([
  "import", "from", "export", "default", "const", "let", "var", "return",
  "if", "else", "new", "async", "await", "function", "type", "interface",
  "as", "extends", "true", "false", "null", "undefined",
]);

const BUILTINS = new Set([
  "defineEnv", "str", "num", "port", "bool", "url", "oneOf", "json",
  "process", "env", "Number",
]);

// Ordered tokenizer: comments and strings first, then words/numbers.
const PATTERN =
  /(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b[A-Za-z_$][\w$]*\b)|(\b\d+\b)|([.]\w+)/g;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(line)) !== null) {
    if (m.index > last) {
      tokens.push({ text: line.slice(last, m.index), cls: "text-ink-soft" });
    }
    const [full, comment, str, word, num, member] = m;
    if (comment) {
      tokens.push({ text: comment, cls: "text-ink-faint italic" });
    } else if (str) {
      tokens.push({ text: str, cls: "text-[#C3E88D]" });
    } else if (word) {
      if (KEYWORDS.has(word)) tokens.push({ text: word, cls: "text-[#C792EA]" });
      else if (BUILTINS.has(word)) tokens.push({ text: word, cls: "text-[#82AAFF]" });
      else tokens.push({ text: word, cls: "text-ink-soft" });
    } else if (num) {
      tokens.push({ text: num, cls: "text-[#F78C6C]" });
    } else if (member) {
      // .method / .prop → soft method color
      tokens.push({ text: member, cls: "text-[#89DDFF]" });
    } else {
      tokens.push({ text: full, cls: "text-ink-soft" });
    }
    last = m.index + full.length;
  }
  if (last < line.length) {
    tokens.push({ text: line.slice(last), cls: "text-ink-soft" });
  }
  return tokens;
}

export function CodeBlock({
  code,
  label,
  tone = "neutral",
  className = "",
}: {
  code: string;
  label?: string;
  tone?: "neutral" | "fail" | "pass";
  className?: string;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  const toneRing =
    tone === "fail"
      ? "border-fail/30"
      : tone === "pass"
      ? "border-pass/30"
      : "border-line";

  return (
    <div
      className={`overflow-hidden rounded-xl border ${toneRing} bg-surface-soft shadow-card ${className}`}
    >
      {label && (
        <div className="flex items-center gap-2 border-b border-line/70 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a4256]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a4256]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a4256]" />
          </span>
          <span className="ml-1 font-mono text-xs text-ink-muted">{label}</span>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.7] sm:text-sm">
        <code>
          {lines.map((line, i) => (
            <Fragment key={i}>
              {tokenize(line).map((t, j) => (
                <span key={j} className={t.cls}>
                  {t.text}
                </span>
              ))}
              {i < lines.length - 1 ? "\n" : ""}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
