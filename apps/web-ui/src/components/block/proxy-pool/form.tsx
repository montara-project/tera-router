import { IconCheck, IconLock, IconPower, IconRouteAltLeft, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { ProxyPoolDto } from '@/lib/api/dtos/proxy-pool/schema'
import type { Models } from '@/lib/api/models'

import { FieldLabel } from '@/components/block/keys/form'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

interface PoolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Create/edit dialog for one pool; keyed by pool and open state so it starts fresh. */
function PoolDialog({
  open,
  onOpenChange,
  pool,
  save,
  saving,
}: PoolDialogProps & {
  pool?: Models.ProxyPool
  save: (body: ProxyPoolDto) => Promise<unknown>
  saving: boolean
}) {
  const id = useId()
  const [name, setName] = useState(pool?.name ?? '')
  const [url, setUrl] = useState(pool?.url ?? '')
  const [bypass, setBypass] = useState(pool?.bypass ?? '')
  const [enabled, setEnabled] = useState(pool?.enabled ?? true)
  const [strict, setStrict] = useState(pool?.strict ?? false)
  const ready = name.trim() !== '' && url.trim() !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    try {
      await save({
        name: name.trim(),
        url: url.trim(),
        // Not shown in this form; kept so editing does not clear it.
        label: pool?.label || undefined,
        bypass: bypass.trim(),
        enabled,
        strict,
      })
      toast.success(pool ? 'Proxy pool updated' : 'Proxy pool created')
      onOpenChange(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const note = 'text-xs text-muted-foreground'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <AlertDialogTitle className="flex items-center gap-2 text-[15px]">
              <IconRouteAltLeft className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
              {pool ? 'Edit proxy pool' : 'Add proxy pool'}
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Accounts bound to this pool send their upstream traffic through it.
            </AlertDialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>

          <div className="scrollbar-seamless min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-name`} label="Name" />
              <Input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="eu-residential"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-url`} label="Proxy URL" />
              <Input
                id={`${id}-url`}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://user:pass@host:port"
                className="font-mono"
                autoComplete="off"
              />
              <p className={note}>HTTP, HTTPS or SOCKS5, credentials inline</p>
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${id}-bypass`} label="Bypass hosts" hint="Optional" />
              <Input
                id={`${id}-bypass`}
                value={bypass}
                onChange={(e) => setBypass(e.target.value)}
                placeholder="localhost,127.0.0.1,.internal"
                className="font-mono"
                autoComplete="off"
              />
              <p className={note}>Comma separated; these connect directly</p>
            </div>

            <div className="divide-y divide-border rounded-md border border-border">
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <div className="flex min-w-0 gap-2.5">
                  <IconPower className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <label htmlFor={`${id}-enabled`} className="block text-[13px] font-medium">
                      Enabled
                    </label>
                    <p className={note}>When off, bound accounts connect directly</p>
                  </div>
                </div>
                <Switch id={`${id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <div className="flex min-w-0 gap-2.5">
                  <IconLock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <label htmlFor={`${id}-strict`} className="block text-[13px] font-medium">
                      Strict mode
                    </label>
                    <p className={note}>
                      When the proxy is unreachable, fail requests instead of retrying directly
                    </p>
                  </div>
                </div>
                <Switch id={`${id}-strict`} checked={strict} onCheckedChange={setStrict} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              <IconCheck />
              {saving ? 'Saving…' : pool ? 'Save changes' : 'Create pool'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AddProxyPoolForm({ open, onOpenChange }: PoolDialogProps) {
  const create = useMutation(queries.proxyPools.create())
  return (
    <PoolDialog
      key={String(open)}
      open={open}
      onOpenChange={onOpenChange}
      save={create.mutateAsync}
      saving={create.isPending}
    />
  )
}

export function EditProxyPoolForm({
  pool,
  open,
  onOpenChange,
}: PoolDialogProps & { pool: Models.ProxyPool }) {
  const update = useMutation(queries.proxyPools.update())
  return (
    <PoolDialog
      key={`${pool.id}-${open}`}
      open={open}
      onOpenChange={onOpenChange}
      pool={pool}
      save={(reqBody) => update.mutateAsync({ id: pool.id, reqBody })}
      saving={update.isPending}
    />
  )
}
