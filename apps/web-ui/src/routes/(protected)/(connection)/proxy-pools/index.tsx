import {
  IconEye,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconRocket,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardToolbar } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { throwAxiosError } from '@/lib/api/axios-error'
import { PROXY_POOL_QUERY_KEY, proxyPoolQueries } from '@/lib/api/queries/proxy-pool'
import { services } from '@/lib/api/services'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/(protected)/(connection)/proxy-pools/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  )
}

function formatTestedAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const { data } = useQuery(proxyPoolQueries.list())
  const pools = data?.data ?? []

  const allSelected = pools.length > 0 && pools.every((pool) => selected[pool.id])
  const someSelected = pools.some((pool) => selected[pool.id])
  const activeCount = pools.filter((pool) => pool.status === 'active').length

  const refresh = () => queryClient.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {}
    if (checked) {
      for (const pool of pools) {
        next[pool.id] = true
      }
    }
    setSelected(next)
  }

  const toggleOne = (id: string) => {
    setSelected((previous) => ({ ...previous, [id]: !previous[id] }))
  }

  const handleDeploy = () => {
    toast.info('Relay deployment is not wired to the backend yet')
  }

  const handleBatchImport = () => {
    toast.info('Batch import is not wired to the backend yet')
  }

  const handleAddPool = async () => {
    await services.proxyPools.store()
    toast.success('Proxy pool created')
    await refresh()
  }

  const handleHealthCheck = async () => {
    const result = await services.proxyPools.healthCheck()
    toast.success(`${result.data.data.tested} pools tested`)
    await refresh()
  }

  if (!data) {
    return <RouteSkeleton />
  }

  return (
    <SectionCard
      title="Proxy Pools"
      description="Route upstream traffic through proxy pools for resilience and geo-distribution."
      toolbar={
        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                <IconRocket />
                <span>Deploy Relay</span>
                <ChevronDown className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDeploy}>Cloudflare Worker</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeploy}>Local process</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" onClick={handleBatchImport}>
            <IconUpload />
            <span>Batch Import</span>
          </Button>

          <Button
            className="bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
            onClick={handleAddPool}
          >
            <IconPlus />
            <span>Add Proxy Pool</span>
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Checkbox
              aria-label="Select all pools"
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={(value) => toggleAll(value === true)}
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
              disabled={pools.length === 0}
              onClick={() => handleHealthCheck().catch(() => toast.error('Health check failed'))}
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
            <Empty className="py-14">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-12 rounded-full">
                  <IconRocket />
                </EmptyMedia>
                <EmptyTitle>No proxy pools yet</EmptyTitle>
                <EmptyDescription>
                  Add a pool to route upstream traffic through resilient exits.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y divide-border">
              {pools.map((pool) => (
                <ProxyPoolRow
                  key={pool.id}
                  pool={pool}
                  selected={Boolean(selected[pool.id])}
                  onToggle={() => toggleOne(pool.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SectionCard>
  )
}

interface ProxyPoolRowProps {
  pool: Models.ProxyPool
  selected: boolean
  onToggle: () => void
}

function ProxyPoolRow({ pool, selected, onToggle }: ProxyPoolRowProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const queryClient = useQueryClient()

  const refresh = () => queryClient.invalidateQueries({ queryKey: [PROXY_POOL_QUERY_KEY] })

  const testMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.proxyPools.test(pool.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success(`Pool ${pool.name} is healthy`)
      return refresh()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.proxyPools.remove(pool.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success('Proxy pool deleted')
      setOpenDelete(false)
      return refresh()
    },
  })

  const handleTest = async () => {
    try {
      await testMutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
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
            tested {formatTestedAgo(pool.testedAt)}
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
