import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { queries } from '@/lib/api/queries'
import { saveFile } from '@/lib/file'

interface AccountsExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: { slug: string; name: string }
}

/**
 * Export one provider's accounts as a JSON file. The credentials are
 * re-encrypted with the passphrase, so the file imports on any Tera Router
 * install; whoever holds the file and the passphrase holds the credentials,
 * which is why the export re-authenticates first.
 */
export default function AccountsExportDialog({
  open,
  onOpenChange,
  provider,
}: AccountsExportDialogProps) {
  const exportMutation = useMutation(queries.accounts.exportByProvider(provider.slug))
  const { confirm: reauth, dialog } = useReauthDialog()
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

  const handleSubmit: React.SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    if (!passphrase || mismatch) return
    const file = await reauth(`export the ${provider.name} accounts`, (creds) =>
      exportMutation.mutateAsync({ ...creds, passphrase })
    )
    if (!file) return
    saveFile(file.blob, file.filename)
    toast.success('Accounts exported', { description: file.filename })
    handleOpenChange(false)
  }

  return (
    <>
      <SimpleAlertScrollableDialogForm
        open={open}
        onOpenChange={handleOpenChange}
        title={`Export ${provider.name} accounts`}
        description="Downloads every account of this provider, with its credentials, as one encrypted JSON file."
        onSubmit={handleSubmit}
        confirmText="Export"
        loading={exportMutation.isPending}
        disabled={!passphrase || mismatch}
        size="md"
      >
        <div className="space-y-2">
          <Label htmlFor="accounts-export-passphrase">Passphrase</Label>
          <Input
            id="accounts-export-passphrase"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accounts-export-passphrase-confirm">Confirm passphrase</Label>
          <Input
            id="accounts-export-passphrase-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && confirm ? (
            <p className="text-xs text-destructive">The passphrases do not match.</p>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          The credentials are encrypted with this passphrase, so the file imports on any Tera Router
          install. Keep the passphrase: it cannot be recovered, and the file is useless without it.
          Labels and metadata (base URL, custom headers) are not encrypted. Proxy pool assignments
          are not included.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A signed-in (OAuth) account keeps working on one install only: once either install
          refreshes its session, the other has to reconnect.
        </p>
      </SimpleAlertScrollableDialogForm>
      {dialog}
    </>
  )
}
