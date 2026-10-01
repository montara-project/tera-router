import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import GuardrailsContent from '@/components/block/guardrails/guardrails-content'
import RouteSkeleton from '@/components/block/guardrails/route-skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(safety)/guardrails/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data } = useQuery(queries.guardrails.overview())
  const overview = data?.data

  if (!overview) {
    return <RouteSkeleton />
  }

  return <GuardrailsContent overview={overview} />
}
