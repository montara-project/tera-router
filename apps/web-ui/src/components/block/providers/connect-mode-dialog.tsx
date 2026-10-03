import { IconBuildingBank, IconKey } from '@tabler/icons-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ConnectModeDialogProps {
  /** The catalog provider being connected, or null when closed. */
  provider: { slug: string; name: string } | null
  onClose: () => void
  /** Pick the existing API-key connect form. */
  onApiKey: () => void
  /** Pick the official-website OAuth sign-in flow. */
  onOAuth: () => void
  oauthPending: boolean
}

const OPTION_CLASS =
  'flex w-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 text-left outline-none transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60'

/**
 * ConnectModeDialog offers the auth-mode choice for providers that support
 * both: signing in to the provider's official website (OAuth popup) or pasting
 * an API key. The OAuth option is wired first — it is the lower-friction path.
 */
export default function ConnectModeDialog({
  provider,
  onClose,
  onApiKey,
  onOAuth,
  oauthPending,
}: ConnectModeDialogProps) {
  const name = provider?.name ?? ''

  return (
    <Dialog
      open={provider !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect {name}</DialogTitle>
          <DialogDescription>
            Choose how Tera Router should authenticate with {name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button
            type="button"
            className={cn(OPTION_CLASS, oauthPending && 'pointer-events-none opacity-60')}
            disabled={oauthPending}
            onClick={onOAuth}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-950 text-emerald-400">
              <IconBuildingBank />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Sign in to {name}</span>
              <span className="block text-xs text-muted-foreground">
                Open {name}&apos;s official website in a popup and connect your account — no key to
                copy.
              </span>
            </span>
          </button>

          <button type="button" className={OPTION_CLASS} onClick={onApiKey}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <IconKey />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Use an API key</span>
              <span className="block text-xs text-muted-foreground">
                Paste an API key from {name}&apos;s dashboard manually.
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
