import { IconGitBranch } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

export default function RoutingPanel({
  chains,
  loading,
  slug,
}: {
  chains: Models.Chain[]
  loading: boolean
  slug: string
}) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  if (!chains.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconGitBranch />
          </EmptyMedia>
          <EmptyTitle>No routing chains use this provider</EmptyTitle>
          <EmptyDescription>Chains that include {slug} will appear here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-3">
      {chains.map((chain) => (
        <Card key={chain.id} className="bg-background">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
              <IconGitBranch />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{chain.name}</p>
              <p className="text-xs text-muted-foreground">
                {chain.steps.length} steps · {chain.strategy}
              </p>
            </div>
            <Badge variant={chain.enabled ? 'success' : 'secondary'} appearance="light">
              {chain.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
