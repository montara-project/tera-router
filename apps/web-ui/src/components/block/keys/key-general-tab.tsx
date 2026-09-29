import { useMutation } from '@tanstack/react-query'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDateTime } from '@/lib/date'

export default function KeyGeneralTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const mutation = useMutation(queries.keys.toggleStatus())

  const handleToggle = async (active: boolean) => {
    try {
      await mutation.mutateAsync({ id: apiKey.id, disabled: !active })
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const active = apiKey.status === 'active'

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Key overview</CardTitle>
          <CardDescription>
            Identity, assignment, and authentication status for this key.
          </CardDescription>
        </CardHeading>
        <CardToolbar>
          <Button
            className={
              active
                ? 'text-destructive hover:text-destructive'
                : 'text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400'
            }
            disabled={mutation.isPending}
            variant="outline"
            onClick={() => handleToggle(active)}
          >
            {active ? 'Disable key' : 'Enable key'}
          </Button>
        </CardToolbar>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailTile label="Name" value={apiKey.name} />
          <DetailTile label="Status">
            <div className="mt-2">
              <KeyStatusBadge status={apiKey.status} />
            </div>
          </DetailTile>
          <DetailTile label="Plan" value={apiKey.plan_label} />
          <DetailTile label="Key identifier" value={apiKey.key_preview} mono />
          <DetailTile label="Internal ID" value={apiKey.id} mono />
          <DetailTile label="Created" value={formatDateTime(apiKey.created_at)} />
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span>
            Last used{' '}
            <span className="text-foreground">
              {apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : 'Never'}
            </span>
          </span>
          <span>
            Updated{' '}
            <span className="text-foreground">
              {formatDateTime(apiKey.updated_at || new Date().toISOString())}
            </span>
          </span>
          {apiKey.scopes ? (
            <span>
              Scopes <span className="text-foreground font-mono">{apiKey.scopes}</span>
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function KeyStatusBadge({ status }: { status: ApiKeyDetail['status'] }) {
  const variant =
    status === 'active' ? 'success' : status === 'restricted' ? 'warning' : 'secondary'
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <Badge variant={variant} appearance="light" size="sm">
      <BadgeDot />
      {label}
    </Badge>
  )
}

function DetailTile({
  label,
  value,
  mono = false,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card className="bg-background">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          {label}
        </p>
        {children ?? (
          <p className={`mt-2 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>
            {value || '—'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
