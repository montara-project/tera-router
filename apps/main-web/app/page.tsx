import {
  ArrowRight,
  Blocks,
  Feather,
  Gauge,
  KeyRound,
  Languages,
  Layers,
  LineChart,
  ListChecks,
  MessagesSquare,
  Radio,
  Route,
  Server,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react'

import { CodeBlock } from '@/components/landing/code-block'
import { dialects, features, providerGroups, steps } from '@/components/landing/data'
import { SectionHeading } from '@/components/landing/section-heading'
import { SiteFooter } from '@/components/landing/site-footer'
import { SiteHeader } from '@/components/landing/site-header'

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
]

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="grid-bg absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <div className="rise-in mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-xs text-dim">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Self-hosted AI inference gateway
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Every AI provider, <span className="text-accent-soft">behind one endpoint</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-dim">
            Tera Router is a unified gateway for your custom AI providers. Speak OpenAI, Anthropic,
            or Responses dialects — route across accounts with fallback, keys, guardrails, and usage
            analytics built in.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#052e16] transition-colors duration-200 hover:bg-accent-soft"
              href="#get-started"
            >
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <a
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-5 py-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-accent/50"
              href="#dialects"
            >
              See the dialects
            </a>
          </div>
        </div>

        <div className="rise-in mx-auto mt-14 max-w-3xl" style={{ animationDelay: '120ms' }}>
          <CodeBlock
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
          <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((stat) => (
              <div className="text-center sm:text-left" key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-mono text-2xl font-semibold text-accent-soft">{stat.value}</dd>
                <dd className="mt-1 text-xs leading-snug text-faint">{stat.label}</dd>
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
    <section className="border-t border-line/60" id="dialects">
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
              <div
                className="rounded-xl border border-line bg-surface p-6 transition-colors duration-200 hover:border-accent/40"
                key={dialect.name}
              >
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-raised text-accent-soft">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{dialect.name}</h3>
                <p className="mt-1.5 font-mono text-xs text-accent-soft">{dialect.endpoint}</p>
                <p className="mt-3 text-sm leading-relaxed text-dim">{dialect.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="border-t border-line/60 bg-surface/40" id="how-it-works">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="Connect accounts once, then let the planner handle the rest: priority order, cooldowns, fallback across providers, and full metering of what each key consumes."
          kicker="How it works"
          title="Connect. Route. Observe."
        />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.icon]
            return (
              <li
                className="relative rounded-xl border border-line bg-[#020617] p-6"
                key={step.title}
              >
                <span className="absolute top-6 right-6 font-mono text-sm text-faint">
                  0{index + 1}
                </span>
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-raised text-accent-soft">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-dim">{step.description}</p>
                <p className="mt-4 rounded-md border border-line/70 bg-surface px-3 py-2 font-mono text-xs text-faint">
                  {step.code}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function Providers() {
  return (
    <section className="border-t border-line/60" id="providers">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="A built-in catalog of presets — base URL, dialect, and auth mode included — plus custom endpoints for anything OpenAI- or Anthropic-compatible."
          kicker="Provider catalog"
          title="Bring every account you already have"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {providerGroups.map((group) => (
            <div
              className={`rounded-xl border border-line bg-surface p-6 ${
                group.providers.length > 6 ? 'md:col-span-2' : ''
              }`}
              key={group.label}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{group.label}</h3>
                <p className="text-xs text-faint">{group.hint}</p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {group.providers.map((provider) => (
                  <li key={provider.name}>
                    <span className="flex cursor-default items-center gap-2.5 rounded-lg border border-line bg-raised px-3 py-2 transition-colors duration-200 hover:border-accent/40">
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-[11px] font-bold"
                        style={{ color: provider.color }}
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
    <section className="border-t border-line/60 bg-surface/40" id="features">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="Routing is the headline — the gateway also carries the operational load: access control, policy, and telemetry, all in one deploy."
          kicker="Under the hood"
          title="Built for running, not just proxying"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = featureIcons[feature.icon]
            return (
              <div
                className="rounded-xl border border-line bg-[#020617] p-5 transition-colors duration-200 hover:border-accent/40"
                key={feature.title}
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-accent-soft">
                  <Icon aria-hidden className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-dim">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function GetStarted() {
  return (
    <section className="border-t border-line/60" id="get-started">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <SectionHeading
          description="One container next to your stack, one base URL in every tool. From clone to first routed request in minutes."
          kicker="Get started"
          title="Two commands to a unified endpoint"
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <CodeBlock
            label="1 · run the gateway"
            lines={[
              '$ git clone montara-project/tera-router',
              '$ cd deploy && docker compose up -d',
            ]}
          />
          <CodeBlock
            label="2 · point your SDK"
            lines={[
              'client = OpenAI(',
              '  base_url="http://localhost:8080/v1",',
              '  api_key="tr_live_…",',
              ')',
            ]}
          />
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-sm text-faint">
          Create a gateway key in the admin dashboard, attach a model allowlist if you want to scope
          it, and ship your first request.
        </p>
      </div>
    </section>
  )
}

function CallToAction() {
  return (
    <section className="border-t border-line/60">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="rounded-2xl border border-accent/25 bg-gradient-to-b from-raised to-surface p-10 text-center sm:p-14">
          <span className="inline-flex size-12 items-center justify-center rounded-xl border border-accent/30 bg-raised text-accent-soft">
            <Zap aria-hidden className="size-6" />
          </span>
          <h2 className="mx-auto mt-6 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Stop juggling SDKs, keys, and quotas
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-dim">
            Give every tool the same base URL and one key. Tera Router picks the account, handles
            the dialect, and shows you exactly what was spent.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#052e16] transition-colors duration-200 hover:bg-accent-soft"
              href="#get-started"
            >
              Get started
              <ArrowRight aria-hidden className="size-4" />
            </a>
            <a
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-raised px-5 py-3 text-sm font-semibold text-ink transition-colors duration-200 hover:border-accent/50"
              href="#providers"
            >
              Browse the catalog
            </a>
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
