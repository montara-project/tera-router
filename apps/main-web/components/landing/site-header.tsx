import { Code2 } from 'lucide-react'

const navLinks = [
  { href: '#dialects', label: 'Dialects' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#providers', label: 'Providers' },
  { href: '#features', label: 'Features' },
  { href: '#get-started', label: 'Get started' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a className="group flex items-center gap-2.5" href="/">
          <img
            alt="Tera Router logo"
            className="size-8 rounded-lg ring-1 ring-white/10"
            src="/static/images/tera.png?v=3"
            height={32}
            width={32}
          />
          <span className="font-semibold tracking-tight transition-colors duration-200 group-hover:text-white">
            Tera Router
          </span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              className="rounded-md px-3 py-2 text-sm text-dim transition-colors duration-200 hover:bg-white/5 hover:text-ink"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised/80 px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:border-accent/40 hover:text-accent-soft"
          href="https://github.com/montara-project/tera-router"
          rel="noreferrer"
          target="_blank"
        >
          <Code2 aria-hidden className="size-4" />
          GitHub
        </a>
      </div>
    </header>
  )
}
