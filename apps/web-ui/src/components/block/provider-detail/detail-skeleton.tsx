import { Skeleton } from '@/components/ui/skeleton'

export default function DetailSkeleton() {
  return (
    <div className="bg-sidebar rounded-2xl border border-sidebar-accent p-2">
      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
