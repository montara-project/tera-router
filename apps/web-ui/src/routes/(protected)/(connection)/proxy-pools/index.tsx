import {
  IconChevronDown,
  IconPlus,
  IconRocket,
  IconRouteAltLeft,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { RelayKind } from '@/lib/api/models/proxy-pool'

import PageHeader from '@/components/block/common/page-header'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import BatchImportDialog from '@/components/block/proxy-pool/batch-import-dialog'
import { AddProxyPoolForm } from '@/components/block/proxy-pool/form'
import PoolsCard from '@/components/block/proxy-pool/pools-card'
import RelayDialog from '@/components/block/proxy-pool/relay-dialog'
import RouteSkeleton from '@/components/block/proxy-pool/route-skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(connection)/proxy-pools/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [relayKind, setRelayKind] = useState<RelayKind | null>(null)

  const { data } = useQuery(queries.proxyPools.list())
  const pools = data?.data ?? []
  const accountsQuery = useQuery(queries.accounts.list({ offset: 0, limit: 1000 }))
  const usedBy = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of accountsQuery.data?.data ?? []) {
      if (a.proxy_pool_id) map.set(a.proxy_pool_id, (map.get(a.proxy_pool_id) ?? 0) + 1)
    }
    return map
  }, [accountsQuery.data])

  const healthCheckMutation = useMutation(queries.proxyPools.healthCheck())
  const bulkDeleteMutation = useMutation(queries.proxyPools.bulkDelete())
  const relayMutation = useMutation(queries.proxyPools.relayScript())
  const selectedIds = pools.filter((pool) => selected[pool.id]).map((pool) => pool.id)

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

  // Every deploy generates a fresh relay secret.
  const handleDeploy = (kind: RelayKind) => {
    setRelayKind(kind)
    relayMutation.mutate(kind, { onError: toastAxiosError })
  }

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds, {
      onSuccess: (res) => {
        toast.success(res.message ?? 'Proxy pools deleted')
        setSelected({})
        setDeleteOpen(false)
      },
      onError: toastAxiosError,
    })
  }

  const handleHealthCheck = async () => {
    const result = await healthCheckMutation.mutateAsync()
    toast.success(`${result.data.tested} ${result.data.tested === 1 ? 'pool' : 'pools'} tested`)
  }

  if (!data) {
    return <RouteSkeleton />
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconRouteAltLeft}
        title="Proxy pools"
        description="Route provider traffic through proxies or edge relays."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <IconRocket />
                  Deploy relay
                  <IconChevronDown className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDeploy('cloudflare')}>
                  Cloudflare Worker
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeploy('local')}>
                  Local process
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <IconUpload />
              Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <IconPlus />
              Add pool
            </Button>
          </>
        }
      />

      {pools.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <IconRouteAltLeft className="size-5" aria-hidden />
          </span>
          <p className="mt-3.5 text-sm font-semibold">No proxy pools yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Without a pool, every account connects to its provider directly.
          </p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>
            <IconPlus />
            Add first pool
          </Button>
        </div>
      ) : (
        <PoolsCard
          pools={pools}
          usedBy={usedBy}
          selected={selected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          healthCheckPending={healthCheckMutation.isPending}
          onHealthCheck={() => handleHealthCheck().catch(toastAxiosError)}
          onDeleteSelected={() => setDeleteOpen(true)}
        />
      )}

      <AddProxyPoolForm open={addOpen} onOpenChange={setAddOpen} />
      <BatchImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <RelayDialog
        // Remount per deploy so the host input starts empty.
        key={relayKind ?? 'closed'}
        kind={relayKind}
        relay={relayMutation.isPending ? undefined : relayMutation.data?.data}
        onClose={() => setRelayKind(null)}
      />
      <SimpleAlertDialog
        confirmText="Delete"
        description={`${selectedIds.length} selected proxy ${selectedIds.length === 1 ? 'pool' : 'pools'} will be permanently deleted. Accounts routed through them fall back to a direct connection.`}
        onConfirm={handleBulkDelete}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Delete the selected proxy pools?"
        variant="destructive"
      />
    </div>
  )
}
