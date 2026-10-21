import {
  Boxes,
  ChartColumn,
  ChevronRight,
  Ellipsis,
  Feather,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Plug,
  Route,
  Search,
  Shield,
  Terminal,
  Users,
  Workflow,
} from 'lucide-react'

import { dialects } from '@/components/landing/data'
import { ProviderAvatar } from '@/components/landing/provider-icons'

// Illustrative product surfaces. Every number below is sample data; every
// capability they depict (dialects, fallback, cooldowns, allowlists, metering)
// exists in apps/server.

const tools = [
  { name: 'Claude Code', via: 'Anthropic SDK', endpoint: '/v1/messages', Icon: Feather },
  { name: 'Cursor', via: 'OpenAI-compatible', endpoint: '/v1/chat', Icon: MessagesSquare },
  { name: 'Codex CLI', via: 'Responses API', endpoint: '/v1/responses', Icon: Workflow },
  { name: 'LangChain', via: 'OpenAI SDK', endpoint: '/v1/chat', Icon: Boxes },
  { name: 'curl & scripts', via: 'any HTTP client', endpoint: 'Bearer tr_…', Icon: Terminal },
]

const accounts = [
  { slug: 'anthropic', name: 'Anthropic', detail: 'priority 1', note: 'api key' },
  { slug: 'gemini', name: 'Gemini', detail: 'priority 2', note: 'account #2' },
  { slug: 'codex', name: 'OpenAI Codex', detail: 'oauth session', note: 'responses' },
  { slug: 'openrouter', name: 'OpenRouter', detail: 'fallback', note: 'any model' },
  { slug: 'custom-openai', name: 'Self-hosted vLLM', detail: 'custom endpoint', note: ':8000/v1' },
]

// Row centres as a % of the card height, so the connector curves land on
// each row. Decorative: an approximation that holds at lg widths only.
const anchors = [26, 41.5, 57, 72.5, 88]

const rowCard =
  'flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 elev-1'

export function RoutingDiagram() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_180px_1fr] lg:gap-0">
      <div className="rounded-2xl border border-line bg-raised/50 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between px-1">
          <p className="text-sm font-medium">Your tools</p>
          <p className="font-mono text-[11px] text-faint">native SDKs</p>
        </div>
        <ul className="grid gap-2">
          {tools.map(({ name, via, endpoint, Icon }) => (
            <li className={rowCard} key={name}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-raised text-dim">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{name}</span>
                <span className="block truncate font-mono text-[11px] text-faint">{via}</span>
              </span>
              <span className="hidden font-mono text-[11px] text-dim sm:block">{endpoint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-center py-2 lg:py-0">
        <svg
          aria-hidden
          className="absolute inset-0 hidden size-full text-dot lg:block"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 200 100"
        >
          {anchors.map((y) => (
            <g key={y}>
              <path
                d={`M0 ${y} C 60 ${y}, 50 50, 100 50`}
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={`M100 50 C 150 50, 140 ${y}, 200 ${y}`}
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>
        <div className="relative flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-line bg-surface elev-2">
            <img
              alt=""
              className="size-8 mix-blend-multiply dark:mix-blend-screen dark:invert"
              height={32}
              src="/static/images/tera.png?v=3"
              width={32}
            />
          </span>
          <p className="mt-3 rounded-md bg-canvas px-2 pt-1 text-sm font-medium">Tera Router</p>
          <p className="rounded-md bg-canvas px-2 pb-1 font-mono text-[11px] text-faint">
            plan · transform · meter
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-raised/50 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between px-1">
          <p className="text-sm font-medium">Your accounts</p>
          <p className="font-mono text-[11px] text-faint">priority order</p>
        </div>
        <ul className="grid gap-2">
          {accounts.map((account) => (
            <li className={rowCard} key={account.name}>
              <ProviderAvatar slug={account.slug} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{account.name}</span>
                <span className="block truncate font-mono text-[11px] text-faint">
                  {account.detail}
                </span>
              </span>
              <span className="hidden font-mono text-[11px] text-dim sm:block">{account.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const sidebar = [
  { label: null, items: [{ name: 'Overview', Icon: LayoutDashboard }] },
  {
    label: 'Gateway',
    items: [
      { name: 'Providers', Icon: Plug },
      { name: 'Accounts', Icon: Users },
      { name: 'Routing chains', Icon: Route },
    ],
  },
  {
    label: 'Access',
    items: [
      { name: 'API keys', Icon: KeyRound },
      { name: 'Guardrails', Icon: Shield },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Usage', Icon: ChartColumn },
      { name: 'Allowlists', Icon: ListChecks },
    ],
  },
]

const metrics = [
  { label: 'Requests (24h)', value: '48,210', badge: '+12.4%' },
  { label: 'Tokens metered', value: '12.6M', badge: 'SSE incl.' },
  { label: 'p50 latency', value: '412 ms', badge: 'upstream' },
  { label: 'Fallback rate', value: '1.8%', badge: '3 chains' },
]

const OK = 'text-accent-soft'
const WARN = 'text-amber-700 dark:text-amber-400'
const FAIL = 'text-red-600 dark:text-red-400'

const requests = [
  {
    slug: 'anthropic',
    model: 'claude-sonnet-4.5',
    route: 'anthropic · #1',
    dialect: 'Messages',
    status: '200 OK',
    tone: OK,
    usage: '18.2k tok · 1.9 s',
  },
  {
    slug: 'gemini',
    model: 'gemini-2.5-pro',
    route: 'gemini · #2',
    dialect: 'Chat',
    status: '200 OK',
    tone: OK,
    usage: '4.1k tok · 0.8 s',
  },
  {
    slug: 'codex',
    model: 'gpt-5-codex',
    route: 'codex · oauth',
    dialect: 'Responses',
    status: '200 stream',
    tone: OK,
    usage: '22.7k tok · 3.4 s',
  },
  {
    slug: 'openrouter',
    model: 'kimi-k2',
    route: 'openrouter · fallback',
    dialect: 'Chat',
    status: '429 → fallback',
    tone: WARN,
    usage: '6.3k tok · 1.2 s',
  },
  {
    slug: 'groq',
    model: 'llama-3.3-70b',
    route: 'groq · #1',
    dialect: 'Chat',
    status: '200 OK',
    tone: OK,
    usage: '2.9k tok · 0.6 s',
  },
  {
    slug: 'mistral',
    model: 'mistral-large',
    route: 'mistral · #1',
    dialect: 'Chat',
    status: 'cooling down',
    tone: FAIL,
    usage: '—',
  },
]

export function DashboardMock() {
  return (
    <div
      aria-label="Preview of the Tera Router admin dashboard showing usage metrics and recently routed requests"
      className="overflow-hidden rounded-2xl border border-line bg-panel elev-3"
      role="img"
    >
      <div className="grid lg:grid-cols-[210px_1fr]">
        <aside className="hidden border-r border-divide bg-raised/40 p-4 lg:block">
          <div className="flex items-center gap-2 px-2">
            <img
              alt=""
              className="size-5 mix-blend-multiply dark:mix-blend-screen dark:invert"
              height={20}
              src="/static/images/tera.png?v=3"
              width={20}
            />
            <span className="text-sm font-semibold">Tera Router</span>
            <span className="ml-auto rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] text-accent-soft">
              ADMIN
            </span>
          </div>
          {sidebar.map((group) => (
            <div className="mt-5" key={group.label ?? 'root'}>
              {group.label && <p className="mb-1.5 px-2 text-[11px] text-faint">{group.label}</p>}
              {group.items.map(({ name, Icon }) => (
                <p
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] ${
                    name === 'Usage' ? 'bg-surface text-ink elev-1' : 'text-dim'
                  }`}
                  key={name}
                >
                  <Icon
                    aria-hidden
                    className={`size-3.5 ${name === 'Usage' ? 'text-accent-soft' : 'text-faint'}`}
                  />
                  {name}
                </p>
              ))}
            </div>
          ))}
        </aside>

        <div className="min-w-0 p-5 sm:p-7">
          <p className="flex items-center gap-1 text-xs text-faint">
            Workspace <ChevronRight aria-hidden className="size-3" /> Insights
            <ChevronRight aria-hidden className="size-3" /> <span className="text-dim">Usage</span>
          </p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                  gateway-01
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-soft">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Healthy · 3 dialects
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xs text-faint">
                localhost:8080 · 7 providers · 12 accounts
              </p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-dim">
                Test connections
              </span>
              <span className="rounded-lg bg-accent/10 px-3 py-1.5 text-[13px] font-medium text-accent-soft">
                New API key
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div className="rounded-xl border border-line bg-surface p-3.5" key={metric.label}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] text-faint">{metric.label}</p>
                  <span className="hidden rounded bg-raised px-1 py-0.5 font-mono text-[9px] text-faint sm:inline">
                    {metric.badge}
                  </span>
                </div>
                <p className="mt-2 font-mono text-lg">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-b border-line bg-raised/50 text-[11px] text-faint uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Dialect</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Usage</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-divide">
                {requests.map((row, i) => (
                  <tr className={i === requests.length - 1 ? 'opacity-55' : ''} key={row.model}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <ProviderAvatar slug={row.slug} />
                        <span>
                          <span className="block font-mono text-[13px]">{row.model}</span>
                          <span className="block font-mono text-[11px] text-faint">
                            {row.route}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dim">{row.dialect}</td>
                    <td className={`px-4 py-3 ${row.tone}`}>{row.status}</td>
                    <td className="px-4 py-3 font-mono text-xs text-dim">{row.usage}</td>
                    <td className="px-4 py-3 text-right text-faint">
                      <Ellipsis aria-hidden className="ml-auto size-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const logLevel = {
  INF: 'text-faint',
  WRN: 'bg-amber-400/15 text-amber-300',
  ERR: 'bg-red-500/15 text-red-300',
} as const

const logs = [
  {
    time: '17:02:11',
    level: 'INF',
    source: 'chat',
    text: 'gemini-2.5-pro → gemini#2 · 200 · 1,204 tok',
  },
  {
    time: '17:02:11',
    level: 'WRN',
    source: 'messages',
    text: 'anthropic#1 429 · cooling down 60s',
  },
  {
    time: '17:02:12',
    level: 'INF',
    source: 'messages',
    text: 'claude-sonnet-4.5 → anthropic#2 · fallback · 200',
  },
  {
    time: '17:02:13',
    level: 'ERR',
    source: 'guardrail',
    text: 'key tr_live_…9f2 · model not in allowlist',
  },
  {
    time: '17:02:14',
    level: 'INF',
    source: 'responses',
    text: 'gpt-5-codex → codex · stream · 22.7k tok',
  },
] as const

export function LogStream() {
  return (
    <div className="fade-b overflow-hidden rounded-xl border border-line bg-panel p-3 sm:p-4">
      <div className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/60 px-3 py-2 text-sm text-faint">
        <Search aria-hidden className="size-3.5" />
        <span className="flex-1 truncate">Filter requests, keys, models…</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent-soft">
          <span className="size-1.5 rounded-full bg-accent" />
          live
        </span>
      </div>
      <ul className="mt-3 grid gap-2.5 overflow-hidden font-mono text-xs">
        {logs.map((log) => (
          <li className="flex items-center gap-3 whitespace-nowrap" key={log.time + log.text}>
            <span className="text-faint">{log.time}</span>
            <span className={`rounded px-1 py-0.5 text-[10px] ${logLevel[log.level]}`}>
              {log.level}
            </span>
            <span className="w-20 shrink-0 text-ink">{log.source}</span>
            <span className="truncate text-dim">{log.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DialectTiles() {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-3">
      {dialects.map((dialect, i) => (
        <li
          className={`rounded-xl border bg-panel p-4 ${i === 0 ? 'border-accent/60 ring-1 ring-accent/40' : 'border-line'}`}
          key={dialect.name}
        >
          <p className="text-sm font-medium">{dialect.name}</p>
          <p className="mt-2 font-mono text-[11px] text-accent-soft">{dialect.endpoint}</p>
        </li>
      ))}
    </ul>
  )
}

// g = success, a = rate-limited (retried elsewhere), r = failed → cooldown
const health = [
  { account: 'anthropic#1', bars: 'gggggggggggggaggggggggggggggar', pct: '97.8%', alert: true },
  { account: 'gemini#2', bars: 'gggggggggggggggggggggggggggggg', pct: '100%', alert: false },
  { account: 'openrouter', bars: 'gggggggggggggggggggagggggggggg', pct: '99.6%', alert: false },
  { account: 'groq#1', bars: 'gggggggggggggggggggggggggggggg', pct: '100%', alert: false },
]

const barTone = { g: 'bg-accent', a: 'bg-amber-400', r: 'bg-red-500' } as const

export function FallbackMonitor() {
  return (
    <ul className="fade-b grid gap-1.5 rounded-xl border border-line bg-panel p-3 sm:p-4">
      {health.map((row) => (
        <li
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${row.alert ? 'bg-red-500/10' : ''}`}
          key={row.account}
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${row.alert ? 'bg-red-500' : 'bg-accent'}`}
          />
          <span className="w-24 shrink-0 truncate font-mono text-xs">{row.account}</span>
          <span aria-hidden className="flex flex-1 gap-[2px]">
            {[...row.bars].map((b, i) => (
              <span
                className={`h-5 flex-1 rounded-[1px] ${barTone[b as keyof typeof barTone]}`}
                key={i}
              />
            ))}
          </span>
          <span className="w-12 text-right font-mono text-[11px] text-faint">{row.pct}</span>
        </li>
      ))}
    </ul>
  )
}

const policies = [
  { label: 'Per-key model allowlists', on: true },
  { label: 'Guardrails policy engine', on: true },
  { label: 'Concurrency limits per key', on: true },
  { label: 'Quotas & budgets per account', on: true },
  { label: 'Proxy pools for upstream egress', on: false },
]

export function PolicyToggles() {
  return (
    <ul className="fade-b divide-y divide-divide rounded-xl border border-line bg-panel px-4">
      {policies.map((policy) => (
        <li className="flex items-center gap-3.5 py-3.5 text-sm" key={policy.label}>
          <span
            aria-hidden
            className={`relative h-5 w-9 shrink-0 rounded-full ${policy.on ? 'bg-accent' : 'bg-raised ring-1 ring-line'}`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-white shadow ${policy.on ? 'right-0.5' : 'left-0.5'}`}
            />
          </span>
          <span className={policy.on ? 'text-ink' : 'text-faint'}>{policy.label}</span>
        </li>
      ))}
    </ul>
  )
}
