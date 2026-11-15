import { Divider, Rail } from '@/components/landing/section'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'

// Shared classes for body copy and inline links, so every legal page reads
// the same without repeating utility strings.
export const paragraph = 'text-base leading-relaxed text-dim'
export const proseLink =
  'font-medium text-accent-soft underline decoration-line underline-offset-4 transition-colors hover:decoration-accent-soft'

export type LegalSection = {
  id: string
  title: string
  body: React.ReactNode
}

type LegalPageProps = {
  title: string
  intro: string
  lastUpdated: string
  sections: LegalSection[]
}

// Frame shared by the legal pages (/terms, /privacy): blueprint rails, sticky
// TOC, numbered sections. Page files only supply metadata + section data.
export function LegalPage({ title, intro, lastUpdated, sections }: LegalPageProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Divider />
        <Rail className="px-5 py-16 sm:px-12 sm:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-widest text-faint">Legal</p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-faint">{intro}</p>
            <p className="mt-6 font-mono text-xs text-faint">Last updated {lastUpdated}</p>
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
            <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
              <p className="font-mono text-xs uppercase tracking-widest text-faint">On this page</p>
              <ul className="mt-4 grid gap-2.5 border-l border-dotted border-dot pl-4">
                {sections.map(({ id, title }) => (
                  <li key={id}>
                    <a
                      className="text-sm text-faint transition-colors hover:text-ink"
                      href={`#${id}`}
                    >
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-faint">{sections.length} sections · ~5 min read</p>
            </nav>

            <div className="min-w-0 max-w-2xl space-y-12">
              {sections.map(({ id, title, body }, index) => (
                <section id={id} key={id}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
                  </div>
                  <div className="mt-4">{body}</div>
                </section>
              ))}
            </div>
          </div>
        </Rail>
      </main>

      <SiteFooter />
    </div>
  )
}
