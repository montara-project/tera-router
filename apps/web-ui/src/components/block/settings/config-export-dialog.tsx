import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { saveFile } from '@/lib/file'

interface ConfigExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Export the configuration as JSON. A passphrase makes the backup portable:
 * credentials are re-keyed so another install can import them; without one
 * they stay sealed to this install's APP_SECRET.
 */
export default function ConfigExportDialog({ open, onOpenChange }: ConfigExportDialogProps) {
  const exportMutation = useMutation(queries.backup.exportConfig())
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')

  const mismatch = passphrase !== confirm

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassphrase('')
      setConfirm('')
    }
    onOpenChange(next)
  }

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    if (mismatch) return
    exportMutation.mutate(
      { passphrase: passphrase || undefined },
      {
        onSuccess: (file) => {
          saveFile(file.blob, file.filename)
          toast.success(passphrase ? 'Portable backup downloaded' : 'Backup downloaded')
          handleOpenChange(false)
        },
        onError: toastAxiosError,
      }
    )
  }

  return (
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={handleOpenChange}
      title="Download JSON backup"
      description="Exports providers, accounts, API keys, plans, chains, aliases, proxy pools, budgets, guardrails, overrides, skills and settings."
      onSubmit={handleSubmit}
      confirmText="Download"
      loading={exportMutation.isPending}
      disabled={mismatch}
      size="md"
    >
      <div className="space-y-2">
        <Label htmlFor="export-passphrase">Passphrase (portable mode)</Label>
        <Input
          id="export-passphrase"
          type="password"
          autoComplete="new-password"
          placeholder="Leave empty to keep credentials sealed to this install"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
      </div>
      {passphrase && (
        <div className="space-y-2">
          <Label htmlFor="export-passphrase-confirm">Confirm passphrase</Label>
          <Input
            id="export-passphrase-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && confirm && (
            <p className="text-destructive text-xs">The passphrases do not match.</p>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        {passphrase
          ? 'Credentials are re-encrypted with this passphrase, so the file imports on any Tera Router install. Keep the passphrase — it cannot be recovered.'
          : 'Without a passphrase, credentials stay encrypted with this install’s APP_SECRET and only an install with the same secret can import them.'}
      </p>
    </SimpleAlertScrollableDialogForm>
  )
}
