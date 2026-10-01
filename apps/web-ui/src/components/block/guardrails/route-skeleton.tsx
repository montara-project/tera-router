import { Skeleton } from '@/components/ui/skeleton'

import { GUARDRAILS_TABS } from './guardrails-tabs'

export default function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>

        <div className="mt-4 flex gap-2">
          {GUARDRAILS_TABS.map((tab) => (
            <Skeleton key={tab.value} className="h-9 w-24 rounded-lg" />
          ))}
        </div>

        <Skeleton className="mt-4 h-32 w-full rounded-xl" />
        <Skeleton className="mt-4 h-4 w-80 rounded-lg" />
        <Skeleton className="mt-4 h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}
