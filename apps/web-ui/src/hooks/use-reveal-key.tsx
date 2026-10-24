import { IconLoader2 } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import TotpCodeInput from '@/components/block/common/totp-code-input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/**
 * Every key reveal re-authenticates: `reveal(id)` opens a dialog asking for the
 * password, then the authenticator code when the server answers
 * totp_required, and resolves with the plaintext key, or null on cancel.
 * Render `dialog` once wherever the hook is used.
 */
export function useRevealKey() {
  const pending = useRef<{ id: string; resolve: (key: string | null) => void } | null>(null)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation(queries.keys.reveal())

  const reveal = (id: string) =>
    new Promise<string | null>((resolve) => {
      pending.current?.resolve(null)
      pending.current = { id, resolve }
      setPassword('')
      setOtp('')
      setNeedsCode(false)
      setError(null)
      setOpen(true)
    })

  const finish = (key: string | null) => {
    pending.current?.resolve(key)
    pending.current = null
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pending.current) return
    setError(null)
    try {
      const res = await mutation.mutateAsync({
        id: pending.current.id,
        password,
        otp: needsCode ? otp : undefined,
      })
      if ('totp_required' in res.data) {
        setNeedsCode(true)
        return
      }
      finish(res.data.full_key)
    } catch (err) {
      setError(axiosErrorMessage(err as Error))
      setOtp('')
      if (!needsCode) setPassword('')
    }
  }

  const canSubmit = needsCode ? otp.length === 6 : password.length > 0

  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => !next && finish(null)}>
      <AlertDialogContent>
        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm it&apos;s you</AlertDialogTitle>
            <AlertDialogDescription>
              {needsCode
                ? 'Enter the 6-digit code from your authenticator app to reveal this API key.'
                : 'Enter your password to reveal this API key.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsCode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reveal-otp">Authentication code</Label>
              <TotpCodeInput id="reveal-otp" value={otp} onChange={setOtp} autoFocus />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reveal-password">Password</Label>
              <Input
                id="reveal-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending && <IconLoader2 className="animate-spin" />}
              {needsCode ? 'Verify' : 'Continue'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { reveal, dialog }
}
