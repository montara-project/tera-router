import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Container,
  Feather,
  Gauge,
  GitBranch,
  KeyRound,
  Languages,
  Layers,
  LineChart,
  ListChecks,
  MessagesSquare,
  Radio,
  Route,
  Scale,
  Server,
  ShieldCheck,
  Workflow,
} from 'lucide-react'

import { CodeBlock } from '@/components/landing/code-block'
import { dialects, features, providerGroups, steps } from '@/components/landing/data'
import { SectionHeading } from '@/components/landing/section-heading'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'

const GITHUB_URL = 'https://github.com/montara-project/tera-router'
const DOCS_URL = 'https://docs.terarouter.xyz'

const dialectIcons = {
  messages: MessagesSquare,
  feather: Feather,
  workflow: Workflow,
} as const

const stepIcons = {
  key: KeyRound,
  route: Route,
  chart: LineChart,
} as const

const featureIcons = {
  layers: Layers,
  languages: Languages,
  'list-checks': ListChecks,
  shield: ShieldCheck,
  gauge: Gauge,
  radio: Radio,
  server: Server,
  blocks: Blocks,
} as const

const stats = [
  { value: '20+', label: 'providers in the catalog' },
  { value: '3', label: 'API dialects, one gateway' },
  { value: 'N×', label: 'accounts per provider' },
  { value: 'SSE', label: 'streaming with usage metering' },
] as const

// Open-source credibility strip. Every claim here is verifiable in the repo:
// MIT licence at the root, the Go 1.26 gateway in apps/server, the deploy/
// compose stack, and the docs site linked from the README.
const trustSignals = [
  { label: 'MIT licensed', detail: 'Fork it, self-host it' },
  { label: 'Go 1.26 gateway', detail: 'One binary, one container' },
  { label: 'No per-token markup', detail: 'You own the endpoint' },
  { label: 'Self-hosted', detail: 'Keys never leave your box' },
] as const

const primaryCta =
  'inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-strong px-5 py-3 text-sm font-semibold text-on-accent elev-2 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-[var(--glow)]'

const secondaryCta =
  'inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface/80 px-5 py-3 text-sm font-semibold text-ink elev-1 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-raised'

// Cards sit on a lifted plane (elev-1) and climb to elev-3 on hover, so the
// 1px border only has to describe the edge — not carry the separation.
const cardBase =
  'relative rounded-2xl border border-line bg-surface elev-1 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-accent/40 hover:elev-3'

const iconTile =
  'flex size-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent-soft'

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="grid-field absolute inset-0 -z-10" />
      <div
        aria-hidden
        className="absolute top-[-360px] left-1/2 -z-10 size-[860px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[150px] dark:bg-accent/[0.09]"
      />
      <div
        aria-hidden
        className="absolute top-[-180px] right-[6%] -z-10 size-[420px] rounded-full bg-[#2dd4bf]/[0.07] blur-[130px] dark:bg-[#2dd4bf]/[0.06]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 sm:pt-28 sm:pb-28">
        <div className="rise-in mx-auto max-w-3xl text-center">
          <p className="sheen elev-1 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 font-mono text-xs text-dim backdrop-blur-sm">
            <span aria-hidden className="relative flex size-1.5">
              <span
                aria-hidden
                className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden"
              />
              <span aria-hidden className="relative inline-flex size-1.5 rounded-full bg-accent" />
            </span>
            Self-hosted AI inference gateway
          </p>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Every AI provider, <span className="text-gradient">behind one endpoint</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-dim">
            Tera Router is a unified gateway for your custom AI providers. Speak OpenAI, Anthropic,
            or Responses dialects — route across accounts with fallback, keys, guardrails, and usage
            analytics built in.
          </p>

          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a className={`${primaryCta} justify-center`} href="#get-started">
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                className={`${secondaryCta} justify-center`}
                href={DOCS_URL}
                rel="noreferrer"
                target="_blank"
              >
                Read the docs
                <ArrowUpRight aria-hidden className="size-4" />
              </a>
              <a
                className={`${secondaryCta} justify-center`}
                href={GITHUB_URL}
                rel="noreferrer"
                target="_blank"
              >
                <GitBranch aria-hidden className="size-4" />
                Star on GitHub
              </a>
            </div>
          </div>

          <ul className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] text-faint">
            {trustSignals.map((signal) => (
              <li className="flex items-center gap-1.5" key={signal.label}>
                <span aria-hidden className="size-1 rounded-full bg-accent/70" />
                <span className="text-dim">{signal.label}</span>
                <span className="hidden sm:inline">· {signal.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rise-in mx-auto mt-14 max-w-3xl" style={{ animationDelay: '120ms' }}>
          <CodeBlock
            className="elev-3 shadow-[var(--glow)]"
            label="terminal"
            lines={[
              '$ curl http://localhost:8080/v1/chat/completions \\',
              '    -H "Authorization: Bearer tr_live_…" \\',
              "    -d '{",
              '        "model": "glm-4.7",',
              '        "messages": [{ "role": "user", "content": "hi" }]',
              "      }'",
              '',
              '← 200 OK · routed via glm (account #2) · 1,204 tok',
            ]}
          />

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {stats.map((stat) => (
              <div
                className="sheen elev-1 rounded-xl border border-line bg-surface px-3 py-4 text-center"
                key={stat.label}
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-gradient font-mono text-2xl font-semibold sm:text-3xl">
                  {stat.value}
                </dd>
                <dd className="mt-1.5 text-xs leading-snug text-faint">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function Dialects() {
  return (
    <section className="border-t border-divide" id="dialects">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="Point any tool at Tera Router and keep its native protocol. The transform engine translates between dialects, so a request made in OpenAI Chat can land on an Anthropic-dialect provider."
          kicker="One gateway · three dialects"
          title="Your tools keep their language"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {dialects.map((dialect) => {
            const Icon = dialectIcons[dialect.icon]
            return (
              <article className={`${cardBase} p-6`} key={dialect.name}>
                <span className={iconTile}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{dialect.name}</h3>
                <p className="mt-2 inline-flex rounded-lg border border-line/70 bg-raised px-2.5 py-1 font-mono text-xs text-accent-soft">
                  {dialect.endpoint}
                </p>
                <p className="mt-3.5 text-sm leading-relaxed text-dim">{dialect.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-t border-divide bg-subtle" id="how-it-works">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="Connect accounts once, then let the planner handle the rest: priority order, cooldowns, fallback across providers, and full metering of what each key consumes."
          kicker="How it works"
          title="Connect. Route. Observe."
        />
        <div className="relative mt-12">
          <div
            aria-hidden
            className="absolute top-1/2 right-[8%] left-[8%] hidden h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent lg:block"
          />
          <ol className="relative grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = stepIcons[step.icon]
              return (
                <li className={`${cardBase} p-6`} key={step.title}>
                  <span className="absolute top-6 right-6 font-mono text-sm text-faint">
                    0{index + 1}
                  </span>
                  <span className={iconTile}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-dim">{step.description}</p>
                  <p className="mt-4 rounded-lg border border-line/70 bg-raised/60 px-3 py-2 font-mono text-xs break-words text-faint">
                    {step.code}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Providers() {
  return (
    <section className="border-t border-divide" id="providers">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="A built-in catalog of presets — base URL, dialect, and auth mode included — plus custom endpoints for anything OpenAI- or Anthropic-compatible."
          kicker="Provider catalog"
          title="Bring every account you already have"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {providerGroups.map((group) => (
            <div
              className={`sheen elev-1 rounded-2xl border border-line bg-surface p-6 ${
                group.providers.length > 6 ? 'md:col-span-2' : ''
              }`}
              key={group.label}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-semibold">{group.label}</h3>
                  <span className="rounded-md border border-line/70 bg-raised px-1.5 py-0.5 font-mono text-[11px] text-faint">
                    {group.providers.length}
                  </span>
                </div>
                <p className="text-xs text-faint">{group.hint}</p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {group.providers.map((provider) => (
                  <li key={provider.name}>
                    <span className="flex cursor-default items-center gap-2.5 rounded-xl border border-line bg-raised/70 elev-1 px-3 py-2 transition-colors duration-200 hover:border-accent/40 hover:bg-raised">
                      <span
                        aria-hidden
                        className="brand-mark flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
                        style={{ '--brand': provider.color } as React.CSSProperties}
                      >
                        {provider.initials}
                      </span>
                      <span className="text-sm whitespace-nowrap text-dim">{provider.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section className="border-t border-divide bg-subtle" id="features">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="Routing is the headline — the gateway also carries the operational load: access control, policy, and telemetry, all in one deploy."
          kicker="Under the hood"
          title="Built for running, not just proxying"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = featureIcons[feature.icon]
            return (
              <article className={`${cardBase} p-5`} key={feature.title}>
                <span className="flex size-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent-soft">
                  <Icon aria-hidden className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">{feature.description}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function GetStarted() {
  return (
    <section className="border-t border-divide" id="get-started">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="One container next to your stack, one base URL in every tool. From clone to first routed request in minutes."
          kicker="Get started"
          title="Two commands to a unified endpoint"
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-5">
          <div>
            <p className="mb-3 flex items-center gap-2.5 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-xs text-accent-soft">
                1
              </span>
              Run the gateway
            </p>
            <CodeBlock
              className="elev-2"
              label="bash"
              lines={[
                '$ git clone montara-project/tera-router',
                '$ cd deploy && docker compose up -d',
              ]}
            />
          </div>
          <div>
            <p className="mb-3 flex items-center gap-2.5 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-mono text-xs text-accent-soft">
                2
              </span>
              Point your SDK
            </p>
            <CodeBlock
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

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Container,
              title: 'Self-host it',
              body: 'deploy/docker-compose.yaml runs the gateway and dashboard as one image on port 8080.',
            },
            {
              icon: Scale,
              title: 'MIT licensed',
              body: 'The whole monorepo is MIT — read it, change it, run it in production.',
            },
            {
              icon: Server,
              title: 'Bring your own stack',
              body: 'No account, no seat licence, no per-token markup — the gateway just routes.',
            },
          ].map(({ body, icon: Icon, title }) => (
            <div
              className="flex gap-3.5 rounded-xl border border-line bg-surface/60 p-4"
              key={title}
            >
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-soft" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-dim">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-4xl text-center text-sm text-faint">
          Create a gateway key in the admin dashboard, attach a model allowlist if you want to scope
          it, and ship your first request.
        </p>
      </div>
    </section>
  )
}

function CallToAction() {
  return (
    <section className="border-t border-divide">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="hairline-gradient relative isolate overflow-hidden rounded-3xl elev-2">
          <div aria-hidden className="grid-field absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="absolute top-[-160px] left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
          />
          <div className="relative px-6 py-14 text-center sm:px-10 sm:py-16">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-soft">
              <GitBranch aria-hidden className="size-6" />
            </span>
            <h2 className="mx-auto mt-6 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop juggling SDKs, keys, and quotas
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-dim">
              Give every tool the same base URL and one key. Tera Router picks the account, handles
              the dialect, and shows you exactly what was spent.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a className={primaryCta} href="#get-started">
                Get started
                <ArrowRight aria-hidden className="size-4" />
              </a>
              <a className={secondaryCta} href={GITHUB_URL} rel="noreferrer" target="_blank">
                View on GitHub
                <ArrowUpRight aria-hidden className="size-4" />
              </a>
            </div>
            <p className="mt-7 font-mono text-xs text-faint">
              MIT licensed · self-hosted · docs.terarouter.xyz
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <Dialects />
        <HowItWorks />
        <Providers />
        <Features />
        <GetStarted />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  )
}
