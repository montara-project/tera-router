import { Skeleton } from '@/components/ui/skeleton'

export default function RouteSkeleton() {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <div className="rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  )
}
