import { IconFingerprint, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
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
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { passkeysSupported } from '@/lib/auth/passkey'

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true })

export default function PasskeysCard() {
  const { data, isLoading } = useQuery(queries.auth.passkeys())
  const passkeys = data?.data ?? []
  const addMutation = useMutation(queries.auth.addPasskey())
  const deleteMutation = useMutation(queries.auth.deletePasskey())
  const { confirm, dialog } = useReauthDialog()
  const [name, setName] = useState('')
  const supported = passkeysSupported()

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const passkey = await confirm('add a passkey', (creds) =>
      addMutation.mutateAsync({ ...creds, name: name.trim() })
    )
    if (!passkey) return
    toast.success('Passkey added')
    setName('')
  }

  return (
    <Card className="rounded-lg bg-card">
      <CardHeader className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <IconBadge
            icon={IconFingerprint}
            variant="soft"
            className="h-10 w-10 shrink-0"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle className="text-sm font-semibold">Passkeys</CardTitle>
            <CardDescription className="text-xs">
              Sign in with Touch ID, Windows Hello, your phone or a security key instead of a
              password and code. A passkey only works on the address it was added on.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <form
          onSubmit={add}
          className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-4"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name, e.g. MacBook"
            aria-label="Passkey name"
            maxLength={64}
            className="min-w-40 flex-1"
            disabled={!supported}
          />
          <Button type="submit" disabled={!supported || addMutation.isPending}>
            Add passkey
          </Button>
          {!supported && (
            <p className="text-muted-foreground w-full text-xs">
              This browser does not support passkeys.
            </p>
          )}
        </form>

        {isLoading ? null : passkeys.length === 0 ? (
          <p className="text-muted-foreground border-t border-border px-4 py-4 text-sm">
            No passkeys yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    {passkey.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    <span className="font-mono">{passkey.rp_id}</span> · Added{' '}
                    {ago(passkey.created_at)}
                    {passkey.last_used_at && ` · Last used ${ago(passkey.last_used_at)}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove passkey ${passkey.name}`}
                  disabled={deleteMutation.isPending}
                  onClick={() =>
                    deleteMutation.mutate(passkey.id, {
                      onSuccess: () => toast.success('Passkey removed'),
                      onError: toastAxiosError,
                    })
                  }
                >
                  <IconTrash className="h-4 w-4" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {dialog}
    </Card>
  )
}
