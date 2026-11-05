import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import PlanFormDialog from '@/components/block/plans/form'
import PlansBudgetsHeader from '@/components/block/plans/plans-budgets-header'
import PlansStats from '@/components/block/plans/plans-stats'
import PlansTable from '@/components/block/plans/plans-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(analytics)/plans/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [openForm, setOpenForm] = useState(false)

  const { data } = useQuery(queries.plans.list())
  const plans = data?.data ?? []
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
          <PlansStats plans={plans} />
          <PlansTable
            plans={plans}
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
