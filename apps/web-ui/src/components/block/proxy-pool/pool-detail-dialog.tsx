import type { Models } from '@/lib/api/models'

import CopyableButton from '@/components/block/common/copyable-button'
import SimpleDialog from '@/components/block/common/simple-dialog'
import { formatTimeAgo } from '@/lib/date'

type PoolDetailDialogProps = {
  pool: Models.ProxyPool
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PoolDetailDialog({ pool, open, onOpenChange }: PoolDetailDialogProps) {
  const rows = [
    { label: 'Status', value: pool.status },
    { label: 'Mode', value: pool.mode || 'forward proxy' },
    { label: 'Label', value: pool.label || '—' },
    { label: 'Last tested', value: pool.tested_at ? formatTimeAgo(pool.tested_at) : 'never' },
  ]

  return (
    <SimpleDialog open={open} onOpenChange={onOpenChange} title={pool.name} size="md">
      <dl className="space-y-3">
        <div className="space-y-1">
          <dt className="text-muted-foreground text-xs">URL</dt>
          <dd className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{pool.url}</code>
            <CopyableButton value={pool.url} sorted={false} size="sm" />
          </dd>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SimpleDialog>
  )
}
