import { IconRefresh, IconRocket } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ProxyPoolRow from '@/components/block/proxy-pool/pool-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardToolbar } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

/**
 * The registered-pool list card: select-all header, active-count pill, health
 * check toolbar action, and one `ProxyPoolRow` per pool. Selection state lives
 * in the route so a future bulk action can consume it; health-check wiring is
 * passed in so the route owns the mutation + toast.
 */
export default function PoolsCard({
  pools,
  selected,
  onToggleAll,
  onToggleOne,
  healthCheckPending,
  onHealthCheck,
}: {
  pools: Models.ProxyPool[]
  selected: Record<string, boolean>
  onToggleAll: (checked: boolean) => void
  onToggleOne: (id: string) => void
  healthCheckPending: boolean
  onHealthCheck: () => void
}) {
  const allSelected = pools.length > 0 && pools.every((pool) => selected[pool.id])
  const someSelected = pools.some((pool) => selected[pool.id])
  const activeCount = pools.filter((pool) => pool.status === 'active').length

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3">
          <Checkbox
            aria-label="Select all pools"
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={(value) => onToggleAll(value === true)}
            size="sm"
          />
          <span className="text-sm">Select all</span>
          <span className="text-muted-foreground text-sm">{pools.length} total</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {activeCount} active
          </span>
        </div>
        <CardToolbar>
          <Button
            disabled={pools.length === 0 || healthCheckPending}
            onClick={onHealthCheck}
            size="sm"
            variant="outline"
          >
            <IconRefresh />
            <span>Health Check</span>
          </Button>
        </CardToolbar>
      </CardHeader>

      <CardContent className="p-0">
        {pools.length === 0 ? (
          <EmptyState
            icon={IconRocket}
            title="No proxy pools yet"
            description="Add a pool to route upstream traffic through resilient exits."
          />
        ) : (
          <div className="divide-y divide-border">
            {pools.map((pool) => (
              <ProxyPoolRow
                key={pool.id}
                pool={pool}
                selected={Boolean(selected[pool.id])}
                onToggle={() => onToggleOne(pool.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
