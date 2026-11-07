import { IconLoader2 } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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

import type { PopupHandle } from './use-oauth-connect'

interface OAuthPollDialogProps {
  /** The device sign-in the dashboard is waiting on, or null when closed. */
  flow: {
    provider: string
    name: string
    state: string
    popup: PopupHandle
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

  useEffect(() => {
    if (!flow) return
    setAttempt(0)

    // One request at a time: the next poll is scheduled only after the
    // previous answer lands, so a slow poll never overlaps the one that
    // consumes the server session (the overlap came back as a 400 toast).
    let stopped = false
    let timer: number | undefined
    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
    }

    const tick = async () => {
      // Read before polling: the popup may close itself right after approval,
      // so one last poll decides whether the grant landed.
      const popupClosed = flow.popup.isClosed()
      try {
        const res = await services.oauth.poll(flow.provider, flow.state)
        if (stopped) return
        if (res.data.data.status !== 'ready') {
          // The user closed the popup without approving: stop burning
          // requests (the flow expires server-side on its own).
          if (popupClosed) {
            stop()
            onCancel()
            return
          }
          setAttempt((n) => n + 1)
          timer = window.setTimeout(tick, flow.intervalMs)
          return
        }
        stop()
        flow.popup.close()
        onCancel()
        toast.success(`${flow.name} connected`)
        void queryClient.invalidateQueries({ queryKey: [ACCOUNT_QUERY_KEY] })
        void queryClient.invalidateQueries({ queryKey: [PROVIDER_QUERY_KEY] })
      } catch (error) {
        if (stopped) return
        // Expired / rejected come back as 4xx: terminal, tell the user why.
        stop()
        toastAxiosError(error)
        flow.popup.close()
        onCancel()
      }
    }
    timer = window.setTimeout(tick, flow.intervalMs)

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
