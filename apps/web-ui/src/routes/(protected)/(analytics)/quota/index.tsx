import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import AccountCapacityCard from '@/components/block/quota/account-capacity-card'
import QuotaSummarySection from '@/components/block/quota/quota-summary-section'
import QuotaTrackerHeader from '@/components/block/quota/quota-tracker-header'
import { Skeleton } from '@/components/ui/skeleton'
import { QUOTA_QUERY_KEY, quotaQueries } from '@/lib/api/queries/quota'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(analytics)/quota/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Models.QuotaRange>('30d')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data, isFetching, isLoading } = useQuery(quotaQueries.overview(range))
  const overview = data?.data

  if (!overview) {
    return <RouteSkeleton />
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] })

  const handleRangeChange = (value: string) => setRange(value as Models.QuotaRange)

  const handleToggle = async (account: Models.QuotaAccount) => {
    setTogglingId(account.id)
    try {
      await services.quota.toggleStatus(account.id)
      toast.success(`Account ${account.status === 'active' ? 'paused' : 'activated'}`)
      await refresh()
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (account: Models.QuotaAccount) => {
    await services.quota.remove(account.id)
    toast.success('Account deleted')
    await refresh()
  }

  return (
    <div className="space-y-4">
      <QuotaTrackerHeader
        onRangeChange={handleRangeChange}
        onRefresh={refresh}
        range={range}
        refreshing={isFetching && !isLoading}
      />

      <QuotaSummarySection summary={overview.summary} />

      <AccountCapacityCard
        accounts={overview.accounts}
        loading={isFetching}
        onDelete={handleDelete}
        onToggle={handleToggle}
        togglingId={togglingId}
      />
    </div>
  )
}
