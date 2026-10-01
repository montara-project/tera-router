import { IconPlus, IconRocket, IconUpload } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import { AddProxyPoolForm } from '@/components/block/proxy-pool/form'
import PoolsCard from '@/components/block/proxy-pool/pools-card'
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

  const { data } = useQuery(queries.proxyPools.list())
  const pools = data?.data ?? []

  const healthCheckMutation = useMutation(queries.proxyPools.healthCheck())

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
      />

      <AddProxyPoolForm open={addOpen} onOpenChange={setAddOpen} />
    </SectionCard>
  )
}
