import { createFileRoute } from '@tanstack/react-router'

import ChainForm from '@/components/block/traffic/chains/chain-form'

export const Route = createFileRoute('/(protected)/(traffic)/chains/new')({
  component: () => <ChainForm />,
})
