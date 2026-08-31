import Link from "next/link";
import { Github, Package } from "lucide-react";
import { Wordmark } from "./logo";
import { site } from "@/lib/site";

const links = [
  { href: "#problem", label: "Why" },
  { href: "#features", label: "Features" },
  { href: "#cli", label: "CLI" },
  { href: "#validators", label: "Validators" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/70 backdrop-blur-lg">
      <nav className="container-content flex h-16 items-center justify-between gap-4">
        <Link href="#top" aria-label="prahari home" className="rounded-lg">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={site.npm}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="prahari on npm"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <Package className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <Link
            href={site.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface/60 px-3 py-2 text-sm text-ink-soft transition-colors hover:border-beam/50 hover:text-ink"
          >
            <Github className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="hidden sm:inline">GitHub</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
