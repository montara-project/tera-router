import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

interface AccountsImportDialogProps {
  /** The parsed export file, or null when the dialog is closed. */
  backup: Record<string, unknown> | null
  fileName: string
  provider: { slug: string; name: string }
  onClose: () => void
}

/**
 * Add the accounts of an export file to this provider. The import only adds:
 * an account whose credential is already stored is skipped, and nothing that
 * exists is changed.
 */
export default function AccountsImportDialog({
  backup,
  fileName,
  provider,
  onClose,
}: AccountsImportDialogProps) {
  const importMutation = useMutation(queries.accounts.importByProvider(provider.slug))
  const [passphrase, setPassphrase] = useState('')

  const count = Array.isArray(backup?.accounts) ? backup.accounts.length : 0

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassphrase('')
      onClose()
    }
  }

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!backup || !passphrase) return
    try {
      const { data } = await importMutation.mutateAsync({ backup, passphrase })
      const skipped = data.skipped.length
      const summary = `${data.imported} ${data.imported === 1 ? 'account' : 'accounts'} imported`
      toast[data.imported > 0 ? 'success' : 'info'](
        skipped > 0 ? `${summary} · ${skipped} already stored` : summary
      )
      handleOpenChange(false)
    } catch (error) {
      // Keep the dialog open: a wrong passphrase is the usual cause.
      toastAxiosError(error)
    }
  }

  return (
    <SimpleAlertScrollableDialogForm
      open={backup !== null}
      onOpenChange={handleOpenChange}
      title={`Import ${provider.name} accounts`}
      description={fileName}
      onSubmit={handleSubmit}
      confirmText={count > 1 ? `Import ${count} accounts` : 'Import account'}
      loading={importMutation.isPending}
      disabled={!passphrase}
      size="md"
    >
      <p className="text-sm leading-relaxed">
        The {count === 1 ? 'account' : `${count} accounts`} in this file will be{' '}
        <span className="font-medium">added</span> to {provider.name}. Accounts whose credential is
        already stored are skipped; nothing existing is changed.
      </p>
      <div className="space-y-2">
        <Label htmlFor="accounts-import-passphrase">Backup passphrase</Label>
        <Input
          id="accounts-import-passphrase"
          type="password"
          autoComplete="off"
          autoFocus
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The passphrase chosen when the file was exported.
        </p>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
