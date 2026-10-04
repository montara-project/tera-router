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
  /** Display name of the provider whose flow is waiting for the paste. */
  providerName: string
  /** What the user must paste: the code the provider displays after
   * approval, or the callback URL from the popup's address bar. */
  mode: 'code' | 'url'
  /** True while the exchange request is in flight. */
  pending: boolean
  onSubmit: (code: string) => void
  onCancel: () => void
}

/**
 * OAuthPasteCodeDialog completes OAuth flows whose popup cannot hand the code
 * back to the dashboard: Claude's popup ends on its display-code page, and
 * Codex's loopback redirect lands on the browser's own machine for a
 * remotely-served dashboard — either way the user pastes what the popup shows.
 */
export default function OAuthPasteCodeDialog({
  open,
  providerName,
  mode,
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

  const description =
    mode === 'url'
      ? `Approve access in the popup — it will end on a page this dashboard can't read, which is expected. Copy the full URL from the popup's address bar, paste it below, then close the popup.`
      : `Approve access in the popup — ${providerName} then shows an authorization code. Copy it and paste it below to complete the sign-in.`
  const placeholder =
    mode === 'url'
      ? 'Paste the callback URL (http://localhost:1455/auth/callback?code=…)'
      : 'Paste the authorization code (looks like xxx#yyy)'

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
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Authorization code"
          autoFocus
          disabled={pending}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder={placeholder}
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
