import { IconLoader2 } from '@tabler/icons-react'
import { useRef, useState } from 'react'

import type { ReauthDto, ReauthResult } from '@/lib/api/dtos/auth/schema'

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

type Job = {
  action: string
  run: (creds: ReauthDto) => Promise<ReauthResult<unknown>>
  resolve: (value: unknown) => void
}

/**
 * Re-authenticates actions that expose secrets (key reveal, backups):
 * `confirm(action, run)` opens a dialog asking for the password, then the
 * authenticator code when the server answers totp_required, and resolves with
 * run's value, or null on cancel. `action` completes "Enter your password
 * to …". Render `dialog` once wherever the hook is used.
 */
export function useReauthDialog() {
  const job = useRef<Job | null>(null)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const confirm = <T,>(
    actionText: string,
    run: (creds: ReauthDto) => Promise<ReauthResult<T>>
  ): Promise<T | null> =>
    new Promise((resolve) => {
      job.current?.resolve(null)
      job.current = { action: actionText, run, resolve: resolve as (value: unknown) => void }
      setAction(actionText)
      setPassword('')
      setOtp('')
      setNeedsCode(false)
      setError(null)
      setOpen(true)
    })

  const finish = (value: unknown) => {
    job.current?.resolve(value)
    job.current = null
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job.current) return
    setError(null)
    setPending(true)
    try {
      const res = await job.current.run({ password, otp: needsCode ? otp : undefined })
      if ('totpRequired' in res) {
        setNeedsCode(true)
        return
      }
      finish(res.value)
    } catch (err) {
      setError(axiosErrorMessage(err as Error))
      setOtp('')
      if (!needsCode) setPassword('')
    } finally {
      setPending(false)
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
                ? `Enter the 6-digit code from your authenticator app to ${action}.`
                : `Enter your password to ${action}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsCode ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reauth-otp">Authentication code</Label>
              <TotpCodeInput id="reauth-otp" value={otp} onChange={setOtp} autoFocus />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reauth-password">Password</Label>
              <Input
                id="reauth-password"
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
            <Button type="submit" disabled={!canSubmit || pending}>
              {pending && <IconLoader2 className="animate-spin" />}
              {needsCode ? 'Verify' : 'Continue'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
