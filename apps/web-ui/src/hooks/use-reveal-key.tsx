import { useMutation } from '@tanstack/react-query'

import { useReauthDialog } from '@/hooks/use-reauth-dialog'
import { queries } from '@/lib/api/queries'

/**
 * Every key reveal re-authenticates: `reveal(id)` asks for the password (and
 * TOTP code when enabled) and resolves with the plaintext key, or null on
 * cancel. Render `dialog` once wherever the hook is used.
 */
export function useRevealKey() {
  const { confirm, dialog } = useReauthDialog()
  const mutation = useMutation(queries.keys.reveal())

  const reveal = (id: string) =>
    confirm<string>('reveal this API key', async (creds) => {
      const res = await mutation.mutateAsync({ id, ...creds })
      return 'totp_required' in res.data ? { totpRequired: true } : { value: res.data.full_key }
    })

  return { reveal, dialog }
}
