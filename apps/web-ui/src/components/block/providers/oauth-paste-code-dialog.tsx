import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface OAuthPasteCodeDialogProps {
  open: boolean
  /** Display name of the provider whose flow is waiting for the code. */
  providerName: string
  /** True while the exchange request is in flight. */
  pending: boolean
  onSubmit: (code: string) => void
  onCancel: () => void
}

/**
 * OAuthPasteCodeDialog collects the authorization code from providers whose
 * OAuth app cannot redirect back to the dashboard (Claude): the popup ends on
 * the provider's display-code page and the user pastes the shown code here.
 */
export default function OAuthPasteCodeDialog({
  open,
  providerName,
  pending,
  onSubmit,
  onCancel,
}: OAuthPasteCodeDialogProps) {
  const [code, setCode] = useState('')

  const submit = () => {
    const trimmed = code.trim()
    if (!trimmed || pending) return
    onSubmit(trimmed)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finish connecting {providerName}</DialogTitle>
          <DialogDescription>
            Approve access in the popup — {providerName} then shows an authorization code. Copy it
            and paste it below to complete the sign-in.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Authorization code"
          autoFocus
          disabled={pending}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="Paste the authorization code (looks like xxx#yyy)"
          value={code}
        />

        <DialogFooter>
          <Button disabled={pending} variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={pending || !code.trim()} onClick={submit}>
            {pending ? 'Connecting…' : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
