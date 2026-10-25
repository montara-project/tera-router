import { IconPlus, IconRocket, IconUpload } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { RelayKind } from '@/lib/api/models/proxy-pool'

import SectionCard from '@/components/block/common/section-card'
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
import { EMERALD_BUTTON_CLASS } from '@/lib/constants/ui'

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
    toast.success(`${result.data.tested} pools tested`)
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
              <Button className={EMERALD_BUTTON_CLASS}>
                <IconRocket />
                <span>Deploy Relay</span>
                <ChevronDown className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDeploy('cloudflare')}>
                Cloudflare Worker
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeploy('local')}>Local process</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <IconUpload />
            <span>Batch Import</span>
          </Button>

          <Button
            className="bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus />
            <span>Add Proxy Pool</span>
          </Button>
        </div>
      }
    >
      <PoolsCard
        pools={pools}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        healthCheckPending={healthCheckMutation.isPending}
        onHealthCheck={() => handleHealthCheck().catch(toastAxiosError)}
        onDeleteSelected={() => setDeleteOpen(true)}
      />

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
    </SectionCard>
  )
}
