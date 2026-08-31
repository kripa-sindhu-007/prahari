import Link from "next/link";
import { Github, Package } from "lucide-react";
import { Wordmark } from "./logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/60 py-12">
      <div className="container-content flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            {site.devanagari} — “the sentinel.” It stands watch over your environment config and
            refuses to let a misconfigured process past the gate.
          </p>
        </div>

        <div className="flex gap-12">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">Project</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={site.repo} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink">
                  GitHub
                </Link>
              </li>
              <li>
                <Link href={site.npm} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink">
                  npm
                </Link>
              </li>
              <li>
                <Link href={`${site.repo}#readme`} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-ink">
                  Docs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="#problem" className="text-ink-soft hover:text-ink">Before / after</Link></li>
              <li><Link href="#features" className="text-ink-soft hover:text-ink">Features</Link></li>
              <li><Link href="#cli" className="text-ink-soft hover:text-ink">CLI</Link></li>
              <li><Link href="#validators" className="text-ink-soft hover:text-ink">Validators</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container-content mt-10 flex flex-col items-center justify-between gap-4 border-t border-line/50 pt-6 sm:flex-row">
        <p className="font-mono text-xs text-ink-faint">
          MIT © {site.name} · built to stand watch.
        </p>
        <div className="flex items-center gap-2">
          <Link href={site.repo} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-raised hover:text-ink">
            <Github className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <Link href={site.npm} target="_blank" rel="noopener noreferrer" aria-label="npm" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-raised hover:text-ink">
            <Package className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
