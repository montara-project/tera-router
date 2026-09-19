import { IconPlus, IconShieldCheck } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import PlanCard from '@/components/block/plans/plan-card'
import PlansStats from '@/components/block/plans/plans-stats'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { PLAN_QUERY_KEY, planQueries } from '@/lib/api/queries/plan'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(analytics)/plans/')({
  component: RouteComponent,
})

function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function RouteComponent() {
  const queryClient = useQueryClient()

  const { data } = useQuery(planQueries.list())
  const plans = data?.data ?? []

  if (!data) {
    return <RouteSkeleton />
  }

  const handleNewPlan = async () => {
    await services.plans.store()
    toast.success('Plan created')
    await queryClient.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] })
  }

  return (
    <SectionCard
      title="Plans"
      description="Reusable templates for API key budget limits, rate limits, and model restrictions."
      toolbar={
        <Button
          className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
          onClick={() => handleNewPlan().catch(() => toast.error('Failed to create plan'))}
        >
          <IconPlus />
          <span>New plan</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <PlansStats plans={plans} />

        <div className="flex items-center gap-3">
          <IconShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            All plans
          </span>
          <div className="h-px flex-1 bg-border" />
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            API keys inherit rules from their assigned plan
          </span>
        </div>

        {plans.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-full">
                <IconShieldCheck />
              </EmptyMedia>
              <EmptyTitle>No plans yet</EmptyTitle>
              <EmptyDescription>
                Create a plan to give API keys budget limits, rate limits, and model restrictions.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
