import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { AccountBulkResult } from '@/lib/api/models/account'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

interface BulkAddKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: { slug: string; name: string }
  onSuccess?: () => Promise<unknown> | void
}

/** Keyed by open state so every open starts from an empty form. */
export default function BulkAddKeysDialog(props: BulkAddKeysDialogProps) {
  return <BulkAddKeysForm key={`${props.provider.slug}-${props.open}`} {...props} />
}

/**
 * Add many API keys to one provider at once: one key per line, each stored
 * as its own account labelled "<prefix> <n>". Keys already stored are
 * skipped; keys the server could not store stay listed so they can be retried.
 */
function BulkAddKeysForm({ open, onOpenChange, provider, onSuccess }: BulkAddKeysDialogProps) {
  const bulkMutation = useMutation(queries.accounts.bulkCreate())
  const [keys, setKeys] = useState('')
  const [labelPrefix, setLabelPrefix] = useState('')
  const [priority, setPriority] = useState('100')
  const [failed, setFailed] = useState<AccountBulkResult['failed']>([])

  const lines = keys
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (lines.length === 0) return
    try {
      const { data } = await bulkMutation.mutateAsync({
        provider: provider.slug,
        api_keys: lines,
        label_prefix: labelPrefix.trim() || undefined,
        priority: Number(priority) || undefined,
      })
      const parts = [`${data.created.length} added`]
      if (data.skipped.length > 0) parts.push(`${data.skipped.length} already stored`)
      if (data.failed.length > 0) parts.push(`${data.failed.length} failed`)
      const summary = parts.join(' · ')
      if (data.created.length > 0) await onSuccess?.()

      if (data.failed.length > 0) {
        // Keep only the failed keys in the box so a retry does not re-send the rest.
        setFailed(data.failed)
        setKeys(data.failed.map((f) => lines[f.index]).join('\n'))
        toast.warning(summary)
        return
      }
      toast[data.created.length > 0 ? 'success' : 'info'](summary)
      onOpenChange(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title={`Bulk add ${provider.name} keys`}
      description="Each key becomes its own account. Keys are encrypted and never shown again."
      onSubmit={handleSubmit}
      confirmText={lines.length > 1 ? `Add ${lines.length} keys` : 'Add key'}
      loading={bulkMutation.isPending}
      disabled={lines.length === 0}
      size="md"
    >
      <div className="space-y-2">
        <Label htmlFor="bulk-keys">API keys</Label>
        <Textarea
          id="bulk-keys"
          rows={8}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder={'One key per line\nsk-...\nsk-...'}
          className="font-mono text-xs"
          value={keys}
          onChange={(e) => setKeys(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {lines.length} {lines.length === 1 ? 'key' : 'keys'} · blank lines are ignored · up to
          1000 per batch
        </p>
      </div>
      {failed.length > 0 ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <p className="font-medium">These keys were not stored and are left in the box:</p>
          <ul className="mt-1 space-y-0.5">
            {failed.map((f) => (
              <li key={f.index}>
                <span className="font-mono">{f.key_fingerprint}</span> · {f.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-2">
          <Label htmlFor="bulk-label-prefix">Label prefix</Label>
          <Input
            id="bulk-label-prefix"
            placeholder="key"
            value={labelPrefix}
            onChange={(e) => setLabelPrefix(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Accounts are named “{labelPrefix.trim() || 'key'} 1”, “{labelPrefix.trim() || 'key'} 2”,
            …
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-priority">Priority</Label>
          <Input
            id="bulk-priority"
            type="number"
            min={1}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Lower runs first.</p>
        </div>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
