import { Skeleton } from '@/components/ui/skeleton'

export default function RouteSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-56 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>
      <Skeleton className="h-10 w-72 rounded-md" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
