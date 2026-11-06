import { IconCheck, IconChevronDown, IconExternalLink, IconLink } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export function portalUrl(token: string) {
  return `${window.location.origin}/portal?id=${encodeURIComponent(token)}`
}

/**
 * Copies the key's usage-portal link, creating it on first use. Anyone with
 * the link reads this key's usage without signing in, so replacing or turning
 * it off asks first.
 */
export default function PortalLinkButton({ apiKey }: { apiKey: ApiKeyDetail }) {
  const token = apiKey.portal_token ?? ''
  const issue = useMutation(queries.keys.issuePortal())
  const revoke = useMutation(queries.keys.revokePortal())
  const { copied, copy } = useCopyToClipboard()
  const [confirm, setConfirm] = useState<'replace' | 'revoke' | null>(null)

  const copyLink = async () => {
    try {
      const value = token || (await issue.mutateAsync(apiKey.id))
      copy(portalUrl(value))
      toast.success(token ? 'Portal link copied' : 'Portal link created and copied')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const replace = async () => {
    setConfirm(null)
    try {
      copy(portalUrl(await issue.mutateAsync(apiKey.id)))
      toast.success('New portal link copied', { description: 'The old link no longer works.' })
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const turnOff = async () => {
    setConfirm(null)
    try {
      await revoke.mutateAsync(apiKey.id)
      toast.success('Portal link turned off')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <>
      <div className="flex">
        <Button
          variant="outline"
          className="rounded-r-none"
          disabled={issue.isPending}
          onClick={() => void copyLink()}
        >
          {copied ? <IconCheck /> : <IconLink />}
          {copied ? 'Copied' : 'Copy portal link'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="-ml-px rounded-l-none"
              aria-label="Portal link options"
            >
              <IconChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {token ? (
              <>
                <DropdownMenuItem asChild>
                  <a href={portalUrl(token)} target="_blank" rel="noreferrer">
                    <IconExternalLink />
                    Open portal
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirm('replace')}>
                  Replace link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirm('revoke')}>
                  Turn off link
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled>No portal link yet</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SimpleAlertDialog
        open={confirm === 'replace'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Replace the portal link?"
        description="The current link stops working. Send the new one to whoever should see this key's usage."
        confirmText="Replace"
        variant="primary"
        onConfirm={() => void replace()}
      />
      <SimpleAlertDialog
        open={confirm === 'revoke'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Turn off the portal link?"
        description="The link stops working. You can create a new one later."
        confirmText="Turn off"
        onConfirm={() => void turnOff()}
      />
    </>
  )
}
