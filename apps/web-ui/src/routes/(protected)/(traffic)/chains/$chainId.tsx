import { IconArrowLeft } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import EmptyState from '@/components/block/common/empty-state'
import ChainForm from '@/components/block/traffic/chains/chain-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/chains/$chainId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { chainId } = Route.useParams()
  const { data, isLoading, isError } = useQuery(queries.chains.get(chainId))
  const chain = data?.data

  if (isLoading) return <Skeleton className="h-96 w-full" />

  if (isError || !chain) {
    return (
      <EmptyState
        title="Chain not found"
        description="It may have been deleted. Go back to the chain list to pick another."
        action={
          <Button asChild variant="outline">
            <Link to="/chains">
              <IconArrowLeft />
              Back to chains
            </Link>
          </Button>
        }
      />
    )
  }

  // Keyed by id so moving between chains starts from that chain's values.
  return <ChainForm key={chain.id} chain={chain} />
}
