import type { ReactNode } from 'react'

import Link from 'next/link'

import { i18n } from '@/lib/i18n'

import { dictionaries } from './dictionaries'

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }))
}

type IconProps = {
  children: ReactNode
  className?: string
}

function Icon({ children, className = 'size-5' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

// Card titles and descriptions come from dictionaries.cards and must stay in
// the same order as these slugs.
const DOC_SECTIONS = [
  {
    slug: '/getting-started/installation',
    icon: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    slug: '/gateway',
    icon: (
      <>
        <path d="M8 3 4 7l4 4" />
        <path d="M4 7h16" />
        <path d="m16 21 4-4-4-4" />
        <path d="M20 17H4" />
      </>
    ),
  },
  {
    slug: '/gateway/model-addressing',
    icon: (
      <>
        <path d="M6 3v12" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </>
    ),
  },
  {
    slug: '/concepts/guardrails',
    icon: (
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    ),
  },
  {
    slug: '/api-reference/dashboard-api',
    icon: (
      <>
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
        <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
      </>
    ),
  },
  {
    slug: '/configuration',
    icon: (
      <>
        <path d="M21 4h-7" />
        <path d="M10 4H3" />
        <path d="M21 12h-9" />
        <path d="M8 12H3" />
        <path d="M21 20h-5" />
        <path d="M12 20H3" />
        <path d="M14 2v4" />
        <path d="M8 10v4" />
        <path d="M16 18v4" />
      </>
    ),
  },
]

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const langs: string[] = i18n.languages
  const copy =
    dictionaries[(langs.includes(lang) ? lang : i18n.defaultLanguage) as keyof typeof dictionaries]
  // The default locale is served from unprefixed URLs.
  const docsBase = lang === i18n.defaultLanguage ? '/docs' : `/${lang}/docs`

  return (
    <main className="relative min-h-svh overflow-hidden bg-fd-background text-fd-foreground">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(600px circle at 80% -10%, color-mix(in oklab, var(--color-fd-primary) 8%, transparent), transparent 70%), radial-gradient(500px circle at 10% 110%, color-mix(in oklab, #10b981 7%, transparent), transparent 70%)',
        }}
      />

      {/* header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link className="flex items-center gap-2.5" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="rounded-lg bg-neutral-100 p-1 dark:bg-white/90"
            src="/tera.png"
            width={32}
            height={32}
          />
          <span className="font-semibold whitespace-nowrap">Tera Router</span>
          <span className="text-fd-muted-foreground hidden rounded-md border border-fd-border px-1.5 py-0.5 text-xs sm:inline-block">
            Docs
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <a
            className="text-fd-muted-foreground hover:text-fd-foreground inline-flex items-center gap-1.5 rounded-lg p-2 text-sm transition-colors"
            href="https://github.com/montara-project/tera-router"
            rel="noreferrer noopener"
            target="_blank"
          >
            <Icon className="size-4.5">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </Icon>
            <span className="sr-only">GitHub</span>
          </a>
          <Link
            className="bg-fd-primary text-fd-primary-foreground rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-opacity hover:opacity-90"
            href={docsBase}
          >
            {copy.navCta}
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-6 pt-14 pb-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-24">
        <div>
          <p className="text-fd-muted-foreground inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card px-3 py-1 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {copy.badge}
          </p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            {copy.heroTitle.before}{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
              {copy.heroTitle.accent}
            </span>
            .
          </h1>
          <p className="text-fd-muted-foreground mt-5 max-w-xl text-lg leading-relaxed">
            {copy.heroDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              className="bg-fd-primary text-fd-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
              href={docsBase}
            >
              {copy.primaryCta}
            </Link>
            <Link
              className="hover:bg-fd-card rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors"
              href={`${docsBase}/gateway`}
            >
              {copy.secondaryCta}
            </Link>
          </div>
          <dl className="text-fd-muted-foreground mt-10 flex flex-wrap gap-8">
            {copy.stats.map((stat) => (
              <div className="flex flex-col" key={stat.label}>
                <dt className="order-2 text-xs">{stat.label}</dt>
                <dd className="text-fd-foreground order-1 text-2xl font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* terminal card */}
        <div className="border-fd-border bg-fd-card overflow-hidden rounded-xl border shadow-lg shadow-black/5">
          <div className="border-fd-border flex items-center gap-1.5 border-b px-4 py-3">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
            <span className="text-fd-muted-foreground ml-2 font-mono text-xs">Terminal</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <code>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">$ </span>
              curl http://localhost:8080/v1/chat/completions{' '}
              <span className="text-fd-muted-foreground">\</span>
              {'\n'}
              <span className="text-fd-muted-foreground">{'  -H'}</span>{' '}
              <span className="text-amber-600 dark:text-amber-400">
                &quot;Authorization: Bearer sk_tr_...&quot;
              </span>{' '}
              <span className="text-fd-muted-foreground">\</span>
              {'\n'}
              <span className="text-fd-muted-foreground">{'  -H'}</span>{' '}
              <span className="text-amber-600 dark:text-amber-400">
                &quot;Content-Type: application/json&quot;
              </span>{' '}
              <span className="text-fd-muted-foreground">\</span>
              {'\n'}
              <span className="text-fd-muted-foreground">{'  -d'}</span> {"'{"}
              {'\n'}
              <span className="text-fd-muted-foreground">{'      "model":'}</span>{' '}
              <span className="text-amber-600 dark:text-amber-400">
                &quot;anthropic/claude-sonnet-4&quot;
              </span>
              ,{'\n'}
              <span className="text-fd-muted-foreground">
                {`      "messages": [{ "role": "user", "content": "${copy.terminalUserMessage}" }],`}
              </span>
              {'\n'}
              {'  '}
              {"}'"}
            </code>
          </pre>
          <div className="border-fd-border text-fd-muted-foreground flex items-center gap-2 border-t px-5 py-3 font-mono text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              X-TeraRouter-Provider:
            </span>
            anthropic
          </div>
        </div>
      </section>

      {/* docs links */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">{copy.exploreTitle}</h2>
        <p className="text-fd-muted-foreground mt-2">{copy.exploreSubtitle}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_SECTIONS.map((section, i) => (
            <Link
              className="group border-fd-border hover:border-fd-primary/60 bg-fd-card/50 rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 motion-reduce:transition-none"
              href={docsBase + section.slug}
              key={section.slug}
            >
              <span className="bg-fd-muted text-fd-foreground inline-flex rounded-lg p-2.5 transition-colors group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                <Icon>{section.icon}</Icon>
              </span>
              <h3 className="mt-4 font-medium">{copy.cards[i]?.title}</h3>
              <p className="text-fd-muted-foreground mt-1 text-sm leading-relaxed">
                {copy.cards[i]?.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-fd-border text-fd-muted-foreground relative z-10 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm">
          <p>{copy.footerText}</p>
          <Link className="hover:text-fd-foreground transition-colors" href={docsBase}>
            {copy.footerCta}
          </Link>
        </div>
      </footer>
    </main>
  )
}
