import { IconActivity, IconGitBranch, IconShield } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import { env } from '@/config/env'
import { useBranding } from '@/hooks/use-branding'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const FEATURES = [
  { icon: IconGitBranch, text: 'Chain routing with automatic provider failover' },
  { icon: IconShield, text: 'Guardrails, budgets and full audit trail per API key' },
  { icon: IconActivity, text: 'Live health probes across providers, models and chains' },
]

// Facts about the second step, kept true to the server: 30-second TOTP steps
// (internal/lib/totp), replay refused (users.totp_last_step), and a 30-day
// refresh token renewed on every use (handlers/auth.go refreshTTL).
const TWO_FACTOR_FEATURES = [
  { icon: IconGitBranch, text: 'TOTP codes rotate every 30 seconds' },
  { icon: IconShield, text: "Each code works once, so it can't be replayed" },
  { icon: IconActivity, text: 'Session expires after 30 days of inactivity' },
]

/** The gateway this console talks to, as shown under the sign-in form. */
export const gatewayHost = new URL(String(env.VITE_API_URL)).host

/** Server version and reachability from the public /health endpoint. */
export function useGatewayHealth() {
  const { data, isPending, isError } = useQuery(queries.system.health())
  return {
    version: data?.version ? `v${data.version}` : undefined,
    state: isPending ? 'checking' : isError || data?.status !== 'ok' ? 'down' : 'up',
  } as const
}

const STATUS = {
  checking: { dot: 'bg-muted-foreground', label: 'Checking gateway status…' },
  up: { dot: 'bg-emerald-500', label: 'All systems operational' },
  down: { dot: 'bg-red-500', label: 'Gateway unreachable' },
}

/** Sign-in left column: brand, pitch, feature list and live gateway status. */
export default function BrandPanel({
  className,
  twoFactorEmail,
}: {
  className?: string
  /** Set while the second step waits for a TOTP code for this account. */
  twoFactorEmail?: string | null
}) {
  const branding = useBranding()
  const health = useGatewayHealth()
  const status = STATUS[health.state]
  const features = twoFactorEmail ? TWO_FACTOR_FEATURES : FEATURES

  return (
    <aside
      className={cn(
        'flex-col justify-between border-e border-border bg-linear-160 from-card to-background p-12',
        className
      )}
    >
      <BrandRow name={branding.name} logo={branding.logo} version={health.version} />

      <div className="flex flex-col gap-5">
        <p className="font-mono text-[11.5px] tracking-[0.6px] text-orange-600 dark:text-orange-400">
          AI GATEWAY CONSOLE
        </p>
        {/* Not a heading: the panel hides on small screens, so the card's "Sign in" is the h1. */}
        <p className="max-w-[460px] text-[34px] leading-[1.2] font-semibold tracking-[-0.9px] text-balance text-foreground">
          {twoFactorEmail
            ? 'Two factors. One console. No shared passwords.'
            : 'One control plane for every model you route.'}
        </p>
        <p className="max-w-[400px] text-[13px] leading-[1.6] text-muted-foreground">
          {twoFactorEmail ? (
            <>
              Your password checked out. Confirm the six-digit code from your authenticator app to
              finish signing in as <span className="text-foreground">{twoFactorEmail}</span> on{' '}
              <span className="text-foreground">{gatewayHost}</span>.
            </>
          ) : (
            'Failover chains, per-key budgets, guardrails and audit logs — across OpenAI, Anthropic, Google and every self-hosted endpoint in between.'
          )}
        </p>
      </div>

      <ul className="flex flex-col gap-3.5">
        {features.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-sm border border-border bg-card">
              <Icon className="size-[13px] text-orange-600 dark:text-orange-400" aria-hidden />
            </span>
            <span className="text-[12.5px] leading-normal text-muted-foreground">{text}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <p className="flex items-center gap-[7px] text-xs text-muted-foreground" role="status">
          <span className={cn('size-1.5 shrink-0 rounded-full', status.dot)} aria-hidden />
          {status.label}
        </p>
        <span className="font-mono text-[11.5px] text-muted-foreground/80">{gatewayHost}</span>
      </div>
    </aside>
  )
}

/** Logo, product name and version pill. */
export function BrandRow({
  name,
  logo,
  version,
  className,
}: {
  name: string
  logo: string
  version?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={logo} alt="" width={24} height={24} className="size-6 rounded-md object-cover" />
      <span className="text-sm font-semibold tracking-[-0.14px] text-foreground">{name}</span>
      {version && (
        <span className="flex h-5 items-center rounded-sm border border-border bg-card px-1.5 font-mono text-[10.5px] text-muted-foreground">
          {version}
        </span>
      )}
    </div>
  )
}
