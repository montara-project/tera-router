import { IconDevices, IconLogout } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

// Checked in order: Edge and Opera also say Chrome, Chrome also says Safari.
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, 'iOS'],
  [/Android/, 'Android'],
  [/Mac OS X/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Linux/, 'Linux'],
]

/** A rough "Chrome on macOS" label; the raw user agent stays in the tooltip. */
function describeAgent(ua: string) {
  const pick = (rules: [RegExp, string][]) => rules.find(([re]) => re.test(ua))?.[1]
  const browser = pick(BROWSERS)
  const system = pick(SYSTEMS)
  if (browser && system) return `${browser} on ${system}`
  return browser ?? system ?? (ua || 'Unknown device')
}

export default function SessionsCard() {
  const { data, isLoading } = useQuery(queries.auth.sessions())
  const sessions = data?.data ?? []
  const revokeMutation = useMutation(queries.auth.revokeSession())

  return (
    <Card className="rounded-lg bg-card">
      <CardHeader className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <IconBadge
            icon={IconDevices}
            variant="soft"
            className="h-10 w-10 shrink-0"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle className="text-sm font-semibold">Active sessions</CardTitle>
            <CardDescription className="text-xs">
              Devices signed in to this dashboard. Revoke one you don't recognise; it is signed out
              at once.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? null : sessions.length === 0 ? (
          <p className="text-muted-foreground border-t border-border px-4 py-4 text-sm">
            No active sessions.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-[12.5px] font-medium text-foreground"
                    title={session.user_agent}
                  >
                    {describeAgent(session.user_agent)}
                    {session.current && (
                      <span className="ml-2 rounded-md bg-emerald-950 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {session.ip_address && <span>{session.ip_address} · </span>}
                    Signed in{' '}
                    {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Revoke ${describeAgent(session.user_agent)} session`}
                    disabled={revokeMutation.isPending}
                    onClick={() =>
                      revokeMutation.mutate(session.id, {
                        onSuccess: () => toast.success('Session revoked'),
                        onError: toastAxiosError,
                      })
                    }
                  >
                    <IconLogout className="h-4 w-4" />
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
