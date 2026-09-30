const footerLinks = [
  { href: '#dialects', label: 'Dialects' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#providers', label: 'Providers' },
  { href: '#features', label: 'Features' },
  { href: '#get-started', label: 'Get started' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-divide">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col justify-between gap-10 sm:flex-row sm:items-start">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <img
                alt="Tera Router logo"
                className="size-7 rounded-lg ring-1 ring-line"
                src="/static/images/tera.png?v=3"
                height={28}
                width={28}
              />
              <span className="font-semibold tracking-tight">Tera Router</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-faint">
              The self-hosted AI inference gateway. Every provider your team uses, behind one
              endpoint you own.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="font-mono text-xs tracking-[0.18em] text-faint uppercase">Explore</p>
            <ul className="mt-4 grid grid-cols-2 gap-x-10 gap-y-2.5">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    className="text-sm text-dim transition-colors duration-200 hover:text-ink"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-faint uppercase">Stack</p>
            <p className="mt-4 font-mono text-xs leading-relaxed text-faint">
              one endpoint · every provider · your box
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-2 border-t border-divide pt-6 text-xs text-faint sm:flex-row">
          <p>© 2026 Tera Router</p>
          <p className="font-mono">built with vinext · deployed on Cloudflare Workers</p>
        </div>
      </div>
    </footer>
  )
}
