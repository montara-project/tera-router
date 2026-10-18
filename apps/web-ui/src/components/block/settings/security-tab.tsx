import { IconShieldLock } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'sonner'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

function CodeInput({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (value: string) => void
  id: string
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      aria-label="Authentication code"
      className="w-32 font-mono tracking-widest"
    />
  )
}

export default function SecurityTab() {
  const { data, isLoading } = useQuery(queries.auth.me())
  const enabled = data?.data?.totp_enabled ?? false

  const setupMutation = useMutation(queries.auth.totpSetup())
  const enableMutation = useMutation(queries.auth.totpEnable())
  const disableMutation = useMutation(queries.auth.totpDisable())

  const [code, setCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const setup = setupMutation.data?.data

  const startSetup = () => {
    setCode('')
    setupMutation.mutate(undefined, { onError: toastAxiosError })
  }

  const confirmEnable = () => {
    if (!setup) return
    enableMutation.mutate(
      { secret: setup.secret, code },
      {
        onSuccess: () => {
          toast.success('Two-factor authentication enabled')
          setupMutation.reset()
          setCode('')
        },
        onError: (error) => {
          setCode('')
          toastAxiosError(error)
        },
      }
    )
  }

  const confirmDisable = () => {
    disableMutation.mutate(
      { code },
      {
        onSuccess: () => {
          toast.success('Two-factor authentication disabled')
          setDisabling(false)
          setCode('')
        },
        onError: (error) => {
          setCode('')
          toastAxiosError(error)
        },
      }
    )
  }

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <IconBadge
              icon={IconShieldLock}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>
                Optional. Ask for a code from an authenticator app such as Google Authenticator when
                signing in.
              </CardDescription>
            </CardHeading>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-md px-2.5 py-1.5 text-xs font-semibold',
              enabled ? 'bg-emerald-950 text-emerald-400' : 'bg-muted text-muted-foreground'
            )}
          >
            {isLoading ? '…' : enabled ? 'Enabled' : 'Off'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="border-t border-border px-5 py-4">
        {enabled ? (
          disabling ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground text-sm">
                Enter a current code to turn two-factor authentication off.
              </p>
              <CodeInput id="totp-disable" value={code} onChange={setCode} />
              <Button
                type="button"
                variant="destructive"
                disabled={code.length !== 6 || disableMutation.isPending}
                onClick={confirmDisable}
              >
                Disable
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDisabling(false)
                  setCode('')
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Sign-in asks for a code from your authenticator app.
              </p>
              <Button type="button" variant="outline" onClick={() => setDisabling(true)}>
                Turn off
              </Button>
            </div>
          )
        ) : setup ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-lg bg-white p-3">
              <QRCodeSVG value={setup.otpauth_url} size={160} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <p className="text-sm">
                Scan the QR code with your authenticator app, then enter the 6-digit code it shows.
              </p>
              <div>
                <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                  Can't scan? Enter this key
                </p>
                <p className="text-foreground mt-0.5 font-mono text-sm break-all select-all">
                  {setup.secret}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <CodeInput id="totp-enable" value={code} onChange={setCode} />
                <Button
                  type="button"
                  disabled={code.length !== 6 || enableMutation.isPending}
                  onClick={confirmEnable}
                >
                  Enable
                </Button>
                <Button type="button" variant="ghost" onClick={() => setupMutation.reset()}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">Sign-in only asks for your password.</p>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || setupMutation.isPending}
              onClick={startSetup}
            >
              Set up
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
