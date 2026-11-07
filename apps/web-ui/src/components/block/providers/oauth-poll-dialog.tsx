import { IconLoader2 } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { ACCOUNT_QUERY_KEY } from '@/lib/api/queries/account'
import { PROVIDER_QUERY_KEY } from '@/lib/api/queries/provider'
import { services } from '@/lib/api/services'

interface OAuthPollDialogProps {
  /** The device sign-in the dashboard is waiting on, or null when closed. */
  flow: {
    provider: string
    name: string
    state: string
    popup: Window
    intervalMs: number
  } | null
  onCancel: () => void
}

/**
 * OAuthPollDialog drives a device sign-in: the user approves access in the
 * provider popup while this dialog polls the server until the grant is ready.
 * An expired or rejected flow ends with a toast and closes the dialog; closing
 * the popup manually abandons the wait.
 */
export default function OAuthPollDialog({ flow, onCancel }: OAuthPollDialogProps) {
  const queryClient = useQueryClient()
  const [attempt, setAttempt] = useState(0)
  // The interval id and popup reference survive re-renders so the loop can be
  // stopped exactly once from either the cancel path or the finish path.
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!flow) return
    setAttempt(0)

    const stop = () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }

    timer.current = window.setInterval(async () => {
      // The user closed the popup before approving: nothing will land, stop
      // burning requests (the flow expires server-side on its own).
      if (flow.popup.closed) {
        stop()
        onCancel()
        return
      }
      try {
        const res = await services.oauth.poll(flow.provider, flow.state)
        const { status } = res.data.data
        if (status !== 'ready') {
          setAttempt((n) => n + 1)
          return
        }
        stop()
        await queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
        await queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
        toast.success(`${flow.name} connected`)
        flow.popup.close()
        onCancel()
      } catch (error) {
        // Expired / rejected come back as 4xx: terminal, tell the user why.
        stop()
        toastAxiosError(error)
        flow.popup.close()
        onCancel()
      }
    }, flow.intervalMs)

    return stop
    // onCancel is stable enough for a flow's lifetime; re-running on its
    // identity would restart the poll loop mid-wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow?.state])

  const open = flow !== null
  const name = flow?.name ?? ''

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Waiting for {name}</DialogTitle>
          <DialogDescription>
            Approve access in the {name} window — this dialog connects the account automatically
            once you have. Closing the popup cancels the sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
          <IconLoader2 className="size-5 shrink-0 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground">
            Checking for approval{attempt > 0 ? ` (${attempt + 1})` : ''}…
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
