import type { Metadata } from 'next'

import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'

import { providerGroups, steps } from '@/components/landing/data'
import { LogStream } from '@/components/landing/log-stream'
import {
  DashboardMock,
  DialectTiles,
  FallbackMonitor,
  PolicyToggles,
  RoutingDiagram,
} from '@/components/landing/mockups'
import { ProviderAvatar, ProviderIconSprite } from '@/components/landing/provider-icons'
import {
  DOCS_URL,
  GITHUB_URL,
  RELEASE_URL,
  Rail,
  Section,
  SectionHeading,
  VERSION,
  primaryButton,
  secondaryButton,
} from '@/components/landing/section'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'
import { Terminal } from '@/components/landing/terminal'
import { pageMeta } from '@/lib/constants/meta'

export const metadata: Metadata = pageMeta({ path: '/' })

// Static content: let the Workers Cache (workersCacheCdnAdapter in
// vite.config.ts) serve it from the edge instead of rendering per request.
// ponytail: 10-min revalidate bounds staleness after a deploy; raise it once
// cache invalidation on deploy is confirmed.
export const revalidate = 600

// Unique providers across every catalog group, for the hero marquee.
const marqueeProviders = [
  ...new Map(
    providerGroups
      .flatMap((group) => group.providers)
      .filter((p) => !p.slug.startsWith('custom-'))
      .map((p) => [p.name, p])
  ).values(),
]

const stats = [
  { value: '20+', label: 'providers in the catalog' },
  { value: '3', label: 'API dialects, one gateway' },
] as const

function ProviderMarquee() {
  const list = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-10 pr-10">
      {marqueeProviders.map((provider) => (
        <li className="flex items-center gap-2.5 whitespace-nowrap" key={provider.name}>
          <ProviderAvatar size="sm" slug={provider.slug} />
          <span className="text-lg font-medium text-dim">{provider.name}</span>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="fade-x overflow-hidden">
      <div className="marquee flex w-max">
        {list(false)}
        {list(true)}
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="hero-glow absolute inset-x-0 top-0 -z-10 h-[760px]" />
      <Rail className="px-5 pt-20 pb-16 sm:px-12 sm:pt-32 sm:pb-20">
        <div className="rise-in max-w-4xl">
          <h1 className="font-display text-5xl leading-[1.02] font-light tracking-[-0.045em] text-balance sm:text-7xl lg:text-[5.75rem]">
            Every AI provider, behind one endpoint.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-pretty text-dim sm:text-xl">
            Tera Router is an open source AI gateway and LLM router. Speak OpenAI, Anthropic, or
            Responses — route across accounts with fallback, keys, guardrails, and usage analytics
            built in.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a className={primaryButton} href="#get-started">
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <a className={secondaryButton} href={DOCS_URL} rel="noreferrer" target="_blank">
              Read the docs
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          </div>
          <p className="mt-6 text-sm text-faint">
            <a
              className="font-mono text-dim underline decoration-dot underline-offset-4 transition-colors hover:text-ink"
              href={RELEASE_URL}
              rel="noreferrer"
              target="_blank"
            >
              {VERSION}
            </a>{' '}
            · GPL-3.0 licensed · self-hosted · no per-token markup.
          </p>
        </div>

        <div className="mt-24">
          <p className="mb-6 text-sm text-faint">
            Routes to the accounts you already pay for — API keys, coding plans, or local models
          </p>
          <ProviderMarquee />
        </div>
      </Rail>
    </section>
  )
}

function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        description="Connect accounts once, then let the planner handle the rest: priority order, cooldowns, fallback across providers, and full metering of what each key consumes."
        title="Turn every account you own into one endpoint."
      >
        <dl className="mt-8 grid grid-cols-2 border-t border-dashed border-line pt-6">
          {stats.map((stat, i) => (
            <div className={i ? 'border-l border-line pl-6' : 'pr-6'} key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-3xl">{stat.value}</dd>
              <dd className="mt-1 text-sm text-faint">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </SectionHeading>

      <div className="mt-16 sm:mt-20">
        <RoutingDiagram />
      </div>

      <ol className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li key={step.title}>
            <p className="font-mono text-xs text-faint">0{i + 1}</p>
            <h3 className="mt-2 font-display text-2xl tracking-tight">{step.title}</h3>
            <p className="mt-3 leading-relaxed text-faint">{step.description}</p>
            <p className="mt-4 inline-block rounded-md border border-line bg-raised/60 px-2.5 py-1 font-mono text-xs break-words text-dim">
              {step.code}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-20 sm:mt-28">
        <DashboardMock />
      </div>
    </Section>
  )
}

const featureCells = [
  {
    title: 'Streaming-first request log',
    body: 'SSE passes straight through for chat and messages, with token usage extracted from the stream itself — no buffering, no lost metrics.',
    Mock: LogStream,
  },
  {
    title: 'Three dialects, one gateway',
    body: 'The transform engine rewrites between OpenAI Chat, Anthropic Messages, and Responses, so a request in one dialect can land on a provider that speaks another.',
    Mock: DialectTiles,
  },
  {
    title: 'Fallback across accounts and providers',
    body: 'Several accounts per provider, tried in priority order. Failures cool down automatically and traffic moves to the next account in the chain.',
    Mock: FallbackMonitor,
  },
  {
    title: 'Policy before traffic leaves your box',
    body: 'Scope every gateway key to specific models, cap its concurrency, and run requests through the guardrails engine — enforced centrally.',
    Mock: PolicyToggles,
  },
]

function Features() {
  return (
    <Section dark id="features">
      <SectionHeading
        description="Routing is the headline. The gateway also carries the operational load — access control, policy, and telemetry — in a single Go service you deploy once."
        title="Built for running, not just proxying."
      />
      <div className="-mx-5 mt-16 grid border-t border-line grid-cols-1 sm:-mx-12 sm:mt-20 md:grid-cols-2">
        {featureCells.map(({ title, body, Mock }, i) => (
          <article
            className={`flex min-w-0 flex-col gap-8 border-b border-line px-5 py-12 sm:px-12 ${
              i % 2 === 0 ? 'md:border-r' : ''
            } ${i >= 2 ? 'md:border-b-0' : ''}`}
            key={title}
          >
            <div className="max-w-md">
              <h3 className="font-display text-xl">{title}</h3>
              <p className="mt-3 leading-relaxed text-faint">{body}</p>
            </div>
            <Mock />
          </article>
        ))}
      </div>
    </Section>
  )
}

function Providers() {
  return (
    <Section id="providers">
      <SectionHeading
        description="A built-in catalog of presets — base URL, dialect, and auth mode included — plus custom endpoints for anything OpenAI- or Anthropic-compatible."
        title="Bring every account you already have."
      />
      <div className="mt-16 divide-y divide-divide rounded-2xl border border-line bg-surface/70 elev-1 sm:mt-20">
        {providerGroups.map((group) => (
          <div
            className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[280px_1fr] lg:gap-10"
            key={group.label}
          >
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-display text-xl">{group.label}</h3>
                <span className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[11px] text-faint">
                  {group.providers.length}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-faint">{group.hint}</p>
            </div>
            <ul className="flex flex-wrap content-start gap-2">
              {group.providers.map((provider) => (
                <li
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas py-1.5 pr-3.5 pl-1.5"
                  key={provider.name}
                >
                  <ProviderAvatar size="sm" slug={provider.slug} />
                  <span className="text-sm whitespace-nowrap text-dim">{provider.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

const notes = [
  {
    title: 'Self-host it',
    body: 'deploy/docker-compose.yaml runs the gateway and dashboard as one image on port 8080.',
  },
  {
    title: 'GPL-3.0 licensed',
    body: 'The whole monorepo is GPL-3.0 — read it, change it, run it in production.',
  },
  {
    title: 'Bring your own stack',
    body: 'No account, no seat licence, no per-token markup — the gateway just routes.',
  },
]

function GetStarted() {
  return (
    <Section id="get-started">
      <SectionHeading
        description="One container next to your stack, one base URL in every tool. From clone to first routed request in minutes."
        title="One container, one base URL."
      />
      <div className="mt-16 grid gap-8 sm:mt-20 md:grid-cols-2 md:gap-5">
        <div>
          <p className="mb-3 text-sm">
            <span className="mr-2 font-mono text-faint">01</span>Run the gateway
          </p>
          <Terminal
            className="elev-2"
            label="bash"
            lines={[
              '$ git clone https://github.com/montara-project/tera-router',
              '$ cd tera-router/deploy',
              '$ echo "APP_MACHINE_ID=1" > .env',
              '$ echo "APP_SECRET=$(openssl rand -base64 48)" >> .env',
              '$ docker compose up -d',
              '✔ Container deploy-app-1  Started',
              '✔ Gateway and dashboard on http://localhost:8080',
            ]}
          />
        </div>
        <div>
          <p className="mb-3 text-sm">
            <span className="mr-2 font-mono text-faint">02</span>Point your SDK
          </p>
          <Terminal
            className="elev-2"
            label="python"
            lines={[
              'client = OpenAI(',
              '  base_url="http://localhost:8080/v1",',
              '  api_key="tr_live_…",',
              ')',
            ]}
          />
        </div>
      </div>

      <div className="mt-12 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {notes.map((note) => (
          <div key={note.title}>
            <p className="font-display text-lg">{note.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-faint">{note.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function CallToAction() {
  return (
    <Section dark>
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <h2 className="font-display text-5xl leading-[1.02] font-medium tracking-[-0.04em] text-balance sm:text-6xl">
          Stop juggling SDKs, keys, and quotas.
        </h2>
        <div>
          <p className="text-lg leading-relaxed text-faint">
            Give every tool the same base URL and one key. Tera Router picks the account, handles
            the dialect, and shows you exactly what was spent.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className={primaryButton} href="#get-started">
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <a className={secondaryButton} href={GITHUB_URL} rel="noreferrer" target="_blank">
              View on GitHub
              <ArrowUpRight aria-hidden className="size-4" />
            </a>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-dim">
            {[
              'GPL-3.0 licensed, free to self-host',
              'Keys never leave your box',
              'One Go binary, one container',
            ].map((item) => (
              <li className="flex items-center gap-2.5" key={item}>
                <Check aria-hidden className="size-4 text-accent-soft" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <ProviderIconSprite />
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Providers />
        <GetStarted />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  )
}
