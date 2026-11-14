import { IconPlus } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import PlanFormDialog from '@/components/block/plans/form'
import PlansBudgetsHeader from '@/components/block/plans/plans-budgets-header'
import PlansStats from '@/components/block/plans/plans-stats'
import PlansTable from '@/components/block/plans/plans-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(analytics)/plans/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [openForm, setOpenForm] = useState(false)

  // The server pages the plans and counts the summary strip.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const { data } = useQuery({
    ...queries.plans.list({ offset, limit }),
    placeholderData: keepPreviousData,
  })
  const meta = data?.metadata
  const settingsQuery = useQuery(queries.settings.get())
  // Defaults to on, matching the server, until settings load.
  const rateLimitsEnforced = settingsQuery.data?.data?.enforce_rate_limits ?? true

  return (
    <div className="flex flex-col gap-5">
      <PlansBudgetsHeader
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <IconPlus />
            <span>New plan</span>
          </Button>
        }
      />

      {data ? (
        <div className="flex flex-col gap-6">
          <PlansStats
            total={meta?.total ?? 0}
            keysAssigned={Number(meta?.keys_assigned ?? 0)}
            hardCutoff={Number(meta?.hard_cutoff ?? 0)}
            unused={Number(meta?.unused ?? 0)}
          />
          <PlansTable
            plans={data.data}
            total={meta?.total ?? 0}
            pageIndex={pageIndex}
            pageSize={limit}
            rateLimitsEnforced={rateLimitsEnforced}
            onCreate={() => setOpenForm(true)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      )}

      <PlanFormDialog open={openForm} onOpenChange={setOpenForm} />
    </div>
  )
}
