import { IconScript } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import PageHeader from '@/components/block/common/page-header'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import ConsoleFeed from '@/components/block/console/console-feed'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(developer)/console/')({
  component: RouteComponent,
})

/** How often the feed refreshes while Live is on. */
const LIVE_INTERVAL_MS = 2000

function RouteComponent() {
  const [live, setLive] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const { data } = useQuery({
    ...queries.console.get(),
    refetchInterval: live ? LIVE_INTERVAL_MS : false,
  })
  const clearMutation = useMutation(queries.console.clear())

  const handleClear = () =>
    clearMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Console cleared')
        setConfirmClear(false)
      },
      onError: () => toast.error('Unable to clear the console. Try again.'),
    })

  return (
    <div className="flex h-[calc(100svh-7rem)] min-h-[32rem] flex-col gap-6">
      <PageHeader
        icon={IconScript}
        title="Console"
        description="Live gateway activity: one row per API request with its outcome, plus background warnings. Expand a row to see why."
      />
      <ConsoleFeed
        entries={data?.data ?? []}
        live={live}
        onLiveChange={setLive}
        onClear={() => setConfirmClear(true)}
      />
      <SimpleAlertDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the console?"
        description="Every line in the feed is removed. Request history stays on the Usage page."
        confirmText="Clear console"
        variant="destructive"
        onConfirm={handleClear}
      />
    </div>
  )
}
