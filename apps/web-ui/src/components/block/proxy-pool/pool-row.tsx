import { IconEye, IconPencil, IconPlayerPlay, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatTimeAgo } from '@/lib/date'
import { cn } from '@/lib/utils'

interface ProxyPoolRowProps {
  pool: Models.ProxyPool
  selected: boolean
  onToggle: () => void
}

export default function ProxyPoolRow({ pool, selected, onToggle }: ProxyPoolRowProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const testMutation = useMutation(queries.proxyPools.test())
  const deleteMutation = useMutation(queries.proxyPools.delete())

  const handleTest = async () => {
    try {
      await testMutation.mutateAsync(pool.id)
      toast.success(`Pool ${pool.name} is healthy`)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(pool.id)
      toast.success('Proxy pool deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Checkbox
        aria-label={`Select ${pool.name}`}
        checked={selected}
        onCheckedChange={onToggle}
        size="sm"
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{pool.name}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
            <span
              className={cn(
                'size-1.5 rounded-full',
                pool.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-500'
              )}
            />
            {pool.status}
          </span>
          {pool.label && (
            <span className="inline-flex items-center rounded-full bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-900/60 ring-inset">
              {pool.label}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <code className="truncate font-mono text-xs text-muted-foreground">{pool.url}</code>
          <span className="text-muted-foreground whitespace-nowrap text-xs">
            tested {formatTimeAgo(pool.tested_at)}
          </span>
          {pool.mode && (
            <span className="text-muted-foreground whitespace-nowrap text-xs">{pool.mode}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-label={`View ${pool.name}`}
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => console.log('view', pool.id)}
          size="icon"
          variant="outline"
        >
          <IconEye />
        </Button>
        <Button
          aria-label={`Test ${pool.name}`}
          className="text-muted-foreground hover:text-foreground"
          disabled={testMutation.isPending}
          mode="icon"
          onClick={() => handleTest()}
          size="icon"
          variant="outline"
        >
          <IconPlayerPlay />
        </Button>
        <Button
          aria-label={`Edit ${pool.name}`}
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => console.log('edit', pool.id)}
          size="icon"
          variant="outline"
        >
          <IconPencil />
        </Button>
        <Button
          aria-label={`Delete ${pool.name}`}
          className="text-muted-foreground hover:text-foreground"
          mode="icon"
          onClick={() => setOpenDelete(true)}
          size="icon"
          variant="outline"
        >
          <IconTrash />
        </Button>
      </div>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Proxy pool "${pool.name}" will be permanently deleted. Traffic routed through it will fail over to other pools.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this proxy pool?"
        variant="destructive"
      />
    </div>
  )
}
