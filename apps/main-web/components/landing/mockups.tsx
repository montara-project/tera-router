import {
  Activity,
  Boxes,
  ChartColumn,
  ChartLine,
  Clock4,
  Cloud,
  Coins,
  DollarSign,
  Feather,
  HeartPulse,
  Hexagon,
  Image,
  KeyRound,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Network,
  Package,
  RefreshCw,
  Replace,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wallet,
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

// Fixed card geometry (lg+): 1px border + p-5 + h-5 header + mb-4, then
// h-14 rows on gap-2. That pins every row centre to an exact y, so the SVG
// connectors (viewBox height = card height) land on the rows without
// measuring the DOM. Change the classes below and these numbers together.
const CARD_H = 390
const NODE_Y = CARD_H / 2
const rowY = (i: number) => 85 + i * 64

const card = 'rounded-2xl border border-line bg-raised/50 p-4 sm:p-5'
const cardHeader = 'mb-4 flex h-5 items-center justify-between px-1'
const rowCard = 'flex h-14 items-center gap-3 rounded-xl border border-line bg-surface px-3 elev-1'

// Requests flow in from the tools, then out to the chosen accounts: left beams
// end at the router, right beams start there, staggered so the eye follows.
function Connectors() {
  const left = tools.map((_, i) => `M0 ${rowY(i)} C 55 ${rowY(i)}, 45 ${NODE_Y}, 100 ${NODE_Y}`)
  const right = accounts.map(
    (_, i) => `M100 ${NODE_Y} C 155 ${NODE_Y}, 145 ${rowY(i)}, 200 ${rowY(i)}`
  )
  const beams = [
    ...left.map((d, i) => ({ d, delay: i * 0.55 })),
    ...right.map((d, i) => ({ d, delay: 1.6 + i * 0.55 })),
  ]
  return (
    <svg
      aria-hidden
      className="absolute inset-0 hidden size-full overflow-visible lg:block"
      fill="none"
      preserveAspectRatio="none"
      viewBox={`0 0 200 ${CARD_H}`}
    >
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id="beam-stroke"
          x1="0"
          x2="200"
          y1="0"
          y2="0"
        >
          <stop offset="0" style={{ stopColor: 'var(--accent)' }} />
          <stop offset="0.5" stopColor="#2dd4bf" />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} />
        </linearGradient>
      </defs>
      {beams.map(({ d }) => (
        <path
          className="text-dot"
          d={d}
          key={`line-${d}`}
          stroke="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {beams.map(({ d, delay }) => (
        <path
          className="beam"
          d={d}
          key={`beam-${d}`}
          pathLength={1}
          stroke="url(#beam-stroke)"
          strokeLinecap="round"
          strokeWidth={2}
          style={{ animationDelay: `${delay}s` }}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

export function RoutingDiagram() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,330px)_1fr_minmax(0,330px)] lg:gap-0">
      <div className={card}>
        <div className={cardHeader}>
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
                <span className="block truncate text-sm">{name}</span>
                <span className="block truncate font-mono text-[11px] text-faint">{via}</span>
              </span>
              <span className="hidden font-mono text-[11px] text-dim sm:block">{endpoint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-center py-2 lg:py-0">
        <Connectors />
        <div className="relative flex flex-col items-center text-center lg:block">
          <span className="relative flex size-14 items-center justify-center rounded-2xl border border-line bg-surface elev-2">
            <img
              alt=""
              className="size-8 mix-blend-multiply dark:mix-blend-screen dark:invert"
              height={32}
              src="/static/images/tera.png?v=3"
              width={32}
            />
          </span>
          {/* Absolutely placed on lg so the logo, not the label, sits on the
              point where every connector meets. */}
          <div className="mt-3 lg:absolute lg:top-full lg:left-1/2 lg:-translate-x-1/2 lg:whitespace-nowrap">
            <p className="rounded-md bg-canvas px-2 pt-1 text-sm font-medium">Tera Router</p>
            <p className="rounded-md bg-canvas px-2 pb-1 font-mono text-[11px] text-faint">
              plan · transform · meter
            </p>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className={cardHeader}>
          <p className="text-sm font-medium">Your accounts</p>
          <p className="font-mono text-[11px] text-faint">priority order</p>
        </div>
        <ul className="grid gap-2">
          {accounts.map((account) => (
            <li className={rowCard} key={account.name}>
              <ProviderAvatar slug={account.slug} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{account.name}</span>
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

// Mirrors apps/web-ui: the sidebar groups come from src/data/sidebar-menu.ts
// (tabler icons swapped for their lucide look-alikes) and the content follows
// the Overview page (routes/(protected)/dashboard, components/block/dashboard).
const sidebar = [
  { label: 'Overview', items: [{ name: 'Dashboard', Icon: LayoutDashboard }] },
  {
    label: 'Traffic',
    items: [
      { name: 'Endpoints', Icon: Network },
      { name: 'Chains', Icon: Layers },
      { name: 'Skills', Icon: Sparkles },
      { name: 'Model Alias', Icon: Replace },
      { name: 'Pricing', Icon: Coins },
    ],
  },
  {
    label: 'Connections',
    items: [
      { name: 'API Keys', Icon: KeyRound },
      { name: 'Providers', Icon: Package },
      { name: 'Media', Icon: Image },
      { name: 'Proxy Pools', Icon: Hexagon },
    ],
  },
  {
    label: 'Safety',
    items: [
      { name: 'Guardrails', Icon: Shield },
      { name: 'Provider Health', Icon: HeartPulse },
    ],
  },
  {
    label: 'Cost & Analytics',
    items: [
      { name: 'Usage', Icon: ChartColumn },
      { name: 'Plans', Icon: Wallet },
      { name: 'Quota Tracker', Icon: Clock4 },
      { name: 'System', Icon: Activity },
      { name: 'Settings', Icon: Settings },
    ],
  },
  {
    label: 'Developer',
    items: [
      { name: 'Console Log', Icon: Terminal },
      { name: 'CLI Tools', Icon: Cloud },
    ],
  },
]

const statCards = [
  {
    label: 'Traffic',
    Icon: Activity,
    tile: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    big: '48.2K',
    bigLabel: 'requests',
    subs: [
      { value: '9.8M', label: 'Input' },
      { value: '2.8M', label: 'Output' },
      { value: '6.1M', label: 'Cache read' },
    ],
  },
  {
    label: 'Spend & Value',
    Icon: DollarSign,
    tile: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    big: '$184.32',
    bigLabel: 'tracked cost',
    subs: [
      { value: '$412.80', label: 'Value saved', tone: 'text-accent-soft' },
      { value: '$0.0038', label: 'Cost / Request' },
      { value: '98%', label: 'Pricing coverage' },
    ],
  },
  {
    label: 'Reliability',
    Icon: ShieldCheck,
    tile: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    big: '99.2%',
    bigLabel: 'successful',
    subs: [
      { value: '386', label: 'Failed', tone: 'text-red-600 dark:text-red-400' },
      { value: '1.4s', label: 'Avg latency' },
      { value: '412ms', label: 'TTFT' },
    ],
  },
]

// Requests per day over the last 30 days, in thousands (sample data).
const trend = [
  0.9, 1.1, 1.0, 1.3, 1.2, 1.6, 1.4, 1.2, 1.5, 1.7, 1.6, 1.9, 1.5, 1.3, 1.6, 1.8, 2.1, 1.9, 1.7,
  2.0, 2.3, 2.2, 1.9, 2.1, 2.4, 2.6, 2.2, 2.5, 2.8, 2.7,
]
const TREND_W = 600
const TREND_H = 160
const trendMax = Math.max(...trend) * 1.1
const trendLine = trend
  .map((v, i) => {
    const x = (i / (trend.length - 1)) * TREND_W
    const y = TREND_H - (v / trendMax) * TREND_H
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  .join(' ')
const trendArea = `${trendLine} L${TREND_W} ${TREND_H} L0 ${TREND_H} Z`

const providerMix = [
  {
    slug: 'anthropic',
    name: 'Anthropic',
    success: '99.6%',
    latency: '1.8s',
    requests: '18.4k',
    cost: '$96.10',
    share: 38.2,
  },
  {
    slug: 'gemini',
    name: 'Gemini',
    success: '99.1%',
    latency: '0.9s',
    requests: '12.1k',
    cost: '$31.42',
    share: 25.1,
  },
  {
    slug: 'codex',
    name: 'OpenAI Codex',
    success: '98.7%',
    latency: '3.2s',
    requests: '9.6k',
    cost: '$41.85',
    share: 19.9,
  },
  {
    slug: 'openrouter',
    name: 'OpenRouter',
    success: '97.9%',
    latency: '1.3s',
    requests: '5.2k',
    cost: '$12.03',
    share: 10.8,
  },
  {
    slug: 'groq',
    name: 'Groq',
    success: '99.8%',
    latency: '0.4s',
    requests: '2.9k',
    cost: '$2.92',
    share: 6.0,
  },
]

const panel = 'rounded-xl border border-line bg-surface p-4 sm:p-5'

function Segmented({ items, active }: { items: string[]; active: string }) {
  return (
    <span className="inline-flex rounded-lg border border-line bg-raised p-0.5 text-xs">
      {items.map((item) => (
        <span
          className={`rounded-md px-2.5 py-1 ${item === active ? 'bg-surface font-medium text-ink elev-1' : 'text-faint'}`}
          key={item}
        >
          {item}
        </span>
      ))}
    </span>
  )
}

function MockSidebar() {
  return (
    <aside className="hidden flex-col rounded-xl border border-line bg-panel p-2 lg:flex">
      <div className="flex items-center gap-2.5 p-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 p-1">
          <img
            alt=""
            className="rounded-md"
            height={24}
            src="/static/images/tera.png?v=3"
            width={24}
          />
        </span>
        <span className="grid gap-1 leading-none">
          <span className="text-sm font-medium">Tera Router</span>
          <span className="text-xs text-faint">AI Router</span>
        </span>
      </div>
      {sidebar.map((group) => (
        <div className="mt-2 px-1" key={group.label}>
          <p className="px-2 py-1.5 text-xs text-faint">{group.label}</p>
          {group.items.map(({ name, Icon }) => {
            const active = name === 'Dashboard'
            return (
              <p
                className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] ${
                  active ? 'bg-raised font-medium text-ink' : 'text-dim'
                }`}
                key={name}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {name}
              </p>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

// Only the top ~half is shown (max-h + fade-b), like the policy panel: enough
// to read the stat cards and charts without a full-height dashboard.
export function DashboardMock() {
  return (
    <div
      aria-label="Preview of the Tera Router admin dashboard: traffic, spend, and reliability cards, a 30-day usage trend, and provider mix"
      className="fade-b max-h-[640px] overflow-hidden rounded-2xl border border-line bg-raised/60 p-2"
      role="img"
    >
      <div className="grid gap-2 lg:grid-cols-[232px_minmax(0,1fr)]">
        <MockSidebar />

        <div className="min-w-0 rounded-xl border border-line bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divide px-5 py-4 sm:px-6">
            <div>
              <p className="text-xl font-semibold">Overview</p>
              <p className="text-sm text-faint">
                A concise view of traffic, spend, and routing performance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Segmented active="30D" items={['Today', '7D', '30D']} />
              <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-dim">
                <RefreshCw aria-hidden className="size-3.5" />
              </span>
            </div>
          </div>

          <div className="grid gap-4 p-4">
            <div className="grid gap-4 xl:grid-cols-3">
              {statCards.map(({ label, Icon, tile, big, bigLabel, subs }) => (
                <div className={`${panel} grid content-start gap-4`} key={label}>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex size-8 items-center justify-center rounded-lg ${tile}`}>
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <p className="text-xs font-semibold tracking-[0.14em] text-faint uppercase">
                      {label}
                    </p>
                  </div>
                  <p>
                    <span className="text-3xl font-semibold">{big}</span>
                    <span className="ml-2 text-sm text-faint">{bigLabel}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-3 border-t border-divide pt-4">
                    {subs.map((sub) => (
                      <div className="min-w-0" key={sub.label}>
                        <p className={`text-sm font-semibold ${sub.tone ?? ''}`}>{sub.value}</p>
                        <p className="mt-0.5 text-[10px] tracking-wide text-faint uppercase">
                          {sub.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              <div className={`${panel} flex flex-col xl:col-span-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ChartLine aria-hidden className="size-4 text-faint" />
                      Usage trend
                    </p>
                    <p className="mt-0.5 text-xs text-faint">Busiest request bucket Oct 19</p>
                  </div>
                  <Segmented active="Requests" items={['Requests', 'Tokens', 'Cost', 'Failures']} />
                </div>
                <svg
                  aria-hidden
                  className="mt-5 h-40 w-full flex-1"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${TREND_W} ${TREND_H}`}
                >
                  <defs>
                    <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.25 }} />
                      <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((f) => (
                    <line
                      className="text-divide"
                      key={f}
                      stroke="currentColor"
                      vectorEffect="non-scaling-stroke"
                      x1="0"
                      x2={TREND_W}
                      y1={TREND_H * f}
                      y2={TREND_H * f}
                    />
                  ))}
                  <path d={trendArea} fill="url(#trend-fill)" />
                  <path
                    d={trendLine}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="mt-2 flex justify-between font-mono text-[10px] text-faint">
                  {['Sep 22', 'Sep 29', 'Oct 6', 'Oct 13', 'Oct 21'].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>

              <div className={`${panel} xl:col-span-2`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Server aria-hidden className="size-4 text-faint" />
                    Provider mix
                  </p>
                  <p className="text-xs text-faint">{providerMix.length} providers</p>
                </div>
                <p className="mt-0.5 text-xs text-faint">Traffic share and delivery quality.</p>
                <div className="mt-5 grid gap-4">
                  {providerMix.map((row) => (
                    <div key={row.slug}>
                      <div className="flex items-center gap-3">
                        <ProviderAvatar size="sm" slug={row.slug} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.name}</p>
                          <p className="truncate text-xs text-faint">
                            {row.success} success · {row.latency} avg
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold">{row.requests} req</p>
                          <p className="text-xs text-faint">{row.cost}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                          <div className="h-full bg-amber-500" style={{ width: `${row.share}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs font-medium tabular-nums">
                          {row.share}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
