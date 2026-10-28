import { ArrowRight, ArrowUpRight } from 'lucide-react'

import {
  DOCS_URL,
  GITHUB_URL,
  RELEASE_URL,
  VERSION,
  primaryButton,
} from '@/components/landing/section'
import { ThemeToggle } from '@/components/landing/theme-toggle'

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#providers', label: 'Providers' },
  { href: DOCS_URL, label: 'Docs', external: true },
]

export function SiteHeader() {
  return (
    <>
      <p className="bg-band px-4 py-2.5 text-center text-xs text-neutral-300">
        <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {VERSION}
        </span>
        Tera Router {VERSION} is out: open source, GPL-3.0 licensed, self-hosted.{' '}
        <a
          className="text-white underline decoration-neutral-500 underline-offset-4 transition-colors hover:decoration-white"
          href={RELEASE_URL}
          rel="noreferrer"
          target="_blank"
        >
          Release notes
        </a>
      </p>
      <header className="sticky top-0 z-50 border-b border-divide bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 xl:px-0">
          <a className="flex items-center gap-2.5" href="/">
            <img
              alt="Tera Router logo"
              className="size-7 mix-blend-multiply dark:mix-blend-screen dark:invert"
              height={28}
              src="/static/images/tera.png?v=3"
              width={28}
            />
            <span className="font-display text-lg font-medium tracking-tight whitespace-nowrap">
              Tera Router
            </span>
          </a>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <a
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-dim transition-colors duration-200 hover:text-ink"
                href={link.href}
                key={link.href}
                {...(link.external ? { rel: 'noreferrer', target: '_blank' } : {})}
              >
                {link.label}
                {link.external && <ArrowUpRight aria-hidden className="size-3.5 opacity-60" />}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              className="hidden text-sm text-dim transition-colors hover:text-ink sm:inline"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a className={`${primaryButton} px-3.5 py-2 max-sm:hidden`} href="#get-started">
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
          </div>
        </div>
      </header>
    </>
  )
}
