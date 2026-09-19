import { IconKey, IconPlus } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { KeysFilters } from '@/components/block/keys/filter-keys'

import IconBadge from '@/components/block/common/icon-badge'
import ReactTable from '@/components/block/common/react-table'
import SectionCard from '@/components/block/common/section-card'
import { KeysColumn } from '@/components/block/keys/column'
import FilterKeys, {
  applyKeysFilters,
  DEFAULT_KEYS_FILTERS,
} from '@/components/block/keys/filter-keys'
import KeysStatsStrip from '@/components/block/keys/keys-stats-strip'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { KEY_QUERY_KEY, keyQueries } from '@/lib/api/queries/key'
import { services } from '@/lib/api/services'
import { getTotal } from '@/lib/constants/paginate'

export const Route = createFileRoute('/(protected)/(connection)/keys/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<KeysFilters>(DEFAULT_KEYS_FILTERS)

  const { offset, limit, pageIndex } = usePaginationQuery()

  const { data, isFetching, isLoading } = useQuery(keyQueries.list({ offset, limit }))

  const loading = isFetching || isLoading
  const total = getTotal(data)
  const keysData = data?.data ?? []
  const columns = KeysColumn({ loading })

  const keys = useMemo(() => applyKeysFilters(data?.data ?? [], filters), [data, filters])

  if (!data) {
    return <RouteSkeleton />
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })

  const handleNewKey = async () => {
    await services.keys.store()
    toast.success('Key created')
    await refresh()
  }

  const handleFilterChange = (patch: Partial<KeysFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch }))

  return (
    <SectionCard
      title="API Keys"
      description="Manage authentication keys, owner portal links, model access, and spend controls."
      toolbar={
        <Button
          className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
          onClick={handleNewKey}
        >
          <IconPlus />
          <span>New key</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <KeysStatsStrip keys={keysData} />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3.5">
              <IconBadge
                icon={IconKey}
                variant="soft"
                className="h-10 w-10"
                iconClassName="h-5 w-5"
              />
              <CardHeading>
                <CardTitle>Key inventory</CardTitle>
                <CardDescription>
                  Copy identifiers, share owner portals, and control access from one place.
                </CardDescription>
              </CardHeading>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <FilterKeys count={keys.length} filters={filters} onChange={handleFilterChange} />

            <ReactTable
              total={total}
              data={keys}
              pageIndex={pageIndex}
              pageSize={limit}
              columns={columns}
            />
          </CardContent>
        </Card>
      </div>
    </SectionCard>
  )
}
