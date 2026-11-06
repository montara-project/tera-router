import { IconArrowRight, IconDots, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import KeySecretDialog from '@/components/block/keys/key-secret-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

interface KeyActionsMenuProps {
  record: Models.ApiKey
  /** list rows link to the detail page; the detail page itself does not */
  showDetails?: boolean
  /** runs after the key is revoked, e.g. to leave its detail page */
  onRevoked?: () => void
  triggerClassName?: string
}

/** "⋯" menu with rotate (re-authenticates, shows the new key once) and revoke. */
export default function KeyActionsMenu({
  record,
  showDetails = false,
  onRevoked,
  triggerClassName = 'size-8',
}: KeyActionsMenuProps) {
  const [openDelete, setOpenDelete] = useState(false)
  const [openRotate, setOpenRotate] = useState(false)
  // One-time secret dialog payload; set from the rotate response, the only
  // moment the API returns the new plaintext key.
  const [rotatedKey, setRotatedKey] = useState<{ full_key: string } | null>(null)

  const deleteMutation = useMutation(queries.keys.delete())
  const rotateMutation = useMutation(queries.keys.rotate())
  const { confirm, dialog: reauthDialog } = useReauthDialog()

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success(`${record.name} revoked`)
      setOpenDelete(false)
      onRevoked?.()
    } catch (error) {
      toastAxiosError(error)
    }
  }

  // Rotating mints a new secret, so it re-authenticates. The new key is shown
  // once in the secret dialog; it cannot be recovered from the app afterwards.
  const handleRotate = async () => {
    setOpenRotate(false)
    const rotated = await confirm<{ full_key: string }>('rotate this API key', async (creds) => {
      const res = await rotateMutation.mutateAsync({ id: record.id, ...creds })
      return 'totp_required' in res.data
        ? { totpRequired: true }
        : { value: { full_key: res.data.full_key } }
    })
    if (rotated) setRotatedKey(rotated)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={showDetails ? 'ghost' : 'outline'}
            size="icon"
            className={triggerClassName}
            aria-label={`Actions for ${record.name}`}
          >
            <IconDots className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {showDetails ? (
            <DropdownMenuItem asChild>
              <Link to="/keys/$keyId" params={{ keyId: record.id }}>
                <IconArrowRight />
                Details
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => setOpenRotate(true)}>
            <IconRefresh />
            Rotate key
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpenDelete(true)}>
            <IconTrash />
            Revoke key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SimpleAlertDialog
        confirmText="Revoke"
        description="Tools using this key stop authenticating immediately. This cannot be undone."
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title={`Revoke ${record.name}?`}
        variant="destructive"
      />
      <SimpleAlertDialog
        confirmText="Rotate"
        description={`Key "${record.name}" gets a new secret. The current one stops authenticating immediately; update every application that uses it.`}
        onConfirm={() => void handleRotate()}
        onOpenChange={setOpenRotate}
        open={openRotate}
        title="Do you want to rotate this key?"
        variant="destructive"
      />
      <KeySecretDialog
        fullKey={rotatedKey?.full_key ?? ''}
        mode="rotated"
        name={record.name}
        onOpenChange={(open) => {
          if (!open) setRotatedKey(null)
        }}
        open={!!rotatedKey}
        planLabel={record.plan_label}
      />
      {reauthDialog}
    </>
  )
}
