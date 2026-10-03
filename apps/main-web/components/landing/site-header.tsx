import { ArrowUpRight, Code2 } from 'lucide-react'

import { ThemeToggle } from '@/components/landing/theme-toggle'

const GITHUB_URL = 'https://github.com/montara-project/tera-router'

const navLinks = [
  { href: '#dialects', label: 'Dialects' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#providers', label: 'Providers' },
  { href: '#features', label: 'Features' },
  { href: '#get-started', label: 'Get started' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-divide bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <a className="group flex items-center gap-2.5" href="/">
          <img
            alt="Tera Router logo"
            className="size-8 rounded-lg ring-1 ring-line"
            height={32}
            src="/static/images/tera.png?v=3"
            width={32}
          />
          <span className="font-semibold tracking-tight transition-colors duration-200 group-hover:text-accent-soft">
            Tera Router
          </span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              className="rounded-lg px-3 py-2 text-sm text-dim transition-colors duration-200 hover:bg-raised hover:text-ink"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface/80 px-3.5 py-2 text-sm font-medium shadow-[var(--shadow-1)] transition-all duration-200 hover:border-accent/40 hover:text-accent-soft"
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            <Code2 aria-hidden className="size-4" />
            <span className="hidden sm:inline">GitHub</span>
            <ArrowUpRight aria-hidden className="hidden size-3.5 opacity-60 sm:inline" />
          </a>
        </div>
      </div>
    </header>
  )
}
