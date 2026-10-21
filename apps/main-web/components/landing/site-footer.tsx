import {
  DOCS_URL,
  Divider,
  GITHUB_URL,
  RELEASE_URL,
  Rail,
  VERSION,
} from '@/components/landing/section'

const columns = [
  {
    title: 'Product',
    links: [
      { href: '#how-it-works', label: 'How it works' },
      { href: '#features', label: 'Features' },
      { href: '#providers', label: 'Providers' },
      { href: '#get-started', label: 'Get started' },
    ],
  },
  {
    title: 'Project',
    links: [
      { href: GITHUB_URL, label: 'GitHub' },
      { href: DOCS_URL, label: 'Documentation' },
      { href: `${GITHUB_URL}/releases`, label: 'Releases' },
      { href: `${GITHUB_URL}/blob/main/LICENSE.md`, label: 'MIT license' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer>
      <Divider />
      <Rail className="px-5 pt-16 pb-10 sm:px-12">
        <div className="grid gap-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <img
                alt="Tera Router logo"
                className="size-7 mix-blend-multiply dark:mix-blend-screen dark:invert"
                height={28}
                src="/static/images/tera.png?v=3"
                width={28}
              />
              <span className="font-display text-lg font-medium tracking-tight">Tera Router</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-faint">
              The self-hosted AI inference gateway. Every provider your team uses, behind one
              endpoint you own.
            </p>
          </div>

          {columns.map((column) => (
            <nav aria-label={column.title} key={column.title}>
              <p className="text-sm font-medium">{column.title}</p>
              <ul className="mt-4 grid gap-2.5">
                {column.links.map((link) => {
                  const external = link.href.startsWith('http')
                  return (
                    <li key={link.href}>
                      <a
                        className="text-sm text-faint transition-colors duration-200 hover:text-ink"
                        href={link.href}
                        {...(external ? { rel: 'noreferrer', target: '_blank' } : {})}
                      >
                        {link.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col justify-between gap-2 border-t border-divide pt-6 text-xs text-faint sm:flex-row">
          <p>
            © 2026 Montara Projects · MIT license ·{' '}
            <a
              className="font-mono transition-colors hover:text-ink"
              href={RELEASE_URL}
              rel="noreferrer"
              target="_blank"
            >
              {VERSION}
            </a>
          </p>
          <p className="font-mono">one endpoint · every provider · your box</p>
        </div>
      </Rail>
    </footer>
  )
}
