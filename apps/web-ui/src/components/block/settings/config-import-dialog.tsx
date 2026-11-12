import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { queries } from '@/lib/api/queries'

interface ConfigImportDialogProps {
  /** The parsed backup document, or null when the dialog is closed. */
  backup: Record<string, unknown> | null
  fileName: string
  onClose: () => void
}

/**
 * Confirm restoring a configuration backup, asking for the passphrase when
 * the backup is portable. The server writes a safety copy of the database
 * before replacing anything.
 */
export default function ConfigImportDialog({ backup, fileName, onClose }: ConfigImportDialogProps) {
  const importMutation = useMutation(queries.backup.importConfig())
  const { confirm, dialog } = useReauthDialog()
  const [passphrase, setPassphrase] = useState('')

  const portable = Boolean(backup?.portable)

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassphrase('')
      onClose()
    }
  }

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    if (!backup) return
    // Importing replaces every credential-bearing table — like export and
    // database restore, it needs a fresh authentication, not just a session.
    void confirm('import a configuration backup', async (creds) => {
      const result = await importMutation.mutateAsync({
        backup,
        passphrase: passphrase || undefined,
        ...creds,
      })
      if ('value' in result) {
        const rows = Object.values(result.value.tables).reduce((sum, n) => sum + n, 0)
        toast.success(`Configuration imported (${rows} rows)`, {
          description: `Safety copy: ${result.value.safety_copy}`,
        })
        handleOpenChange(false)
      }
      return result
    })
  }

  return (
    <>
      <SimpleAlertScrollableDialogForm
        open={backup !== null}
        onOpenChange={handleOpenChange}
        title="Import JSON backup"
        description={fileName}
        onSubmit={handleSubmit}
        confirmText="Replace configuration"
        loading={importMutation.isPending}
        disabled={portable && !passphrase}
        size="md"
      >
        <p className="text-sm leading-relaxed">
          Every configuration table in the backup — providers, accounts, API keys, plans, chains,
          aliases, proxy pools, budgets, guardrails, overrides, skills and settings —{' '}
          <span className="font-medium">replaces</span> the current one. Users and usage history are
          kept. A safety copy of the database is written first.
        </p>
        {portable && (
          <div className="space-y-2">
            <Label htmlFor="import-passphrase">Backup passphrase</Label>
            <Input
              id="import-passphrase"
              type="password"
              autoComplete="off"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              This is a portable backup: its credentials are encrypted with the passphrase chosen at
              export.
            </p>
          </div>
        )}
      </SimpleAlertScrollableDialogForm>
      {dialog}
    </>
  )
}
