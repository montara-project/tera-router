import { IconCheck, IconChevronDown, IconCopy, IconX } from '@tabler/icons-react'
import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { env } from '@/config/env'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

interface KeySecretDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'created' | 'rotated'
  name: string
  planLabel?: string
  fullKey: string
}

/** One-shot usage snippet a client needs to reach the gateway. The full key is
 * only ever shown in this dialog, so the snippet embeds it verbatim. */
function setupMessage(fullKey: string) {
  const base = `${env.API_URL.replace(/\/+$/, '')}/v1`
  return [
    `Base URL: ${base}`,
    '',
    `curl ${base}/chat/completions \\`,
    `  -H "Authorization: Bearer ${fullKey}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
  ].join('\n')
}

/** Copy/Copied icon pair: a cross-fade, with scale and blur only when motion is allowed. */
function CopyIcon({ copied }: { copied: boolean }) {
  const swap =
    'transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-opacity'
  const hidden = 'opacity-0 motion-safe:scale-25 motion-safe:blur-[4px]'
  return (
    <span className="grid *:col-start-1 *:row-start-1" aria-hidden>
      <IconCopy className={cn(swap, copied && hidden)} />
      <IconCheck className={cn(swap, !copied && hidden)} />
    </span>
  )
}

/** One-time secret dialog after creating or rotating a key: the plaintext key
 * is shown here and nowhere else in the app afterwards. */
export default function KeySecretDialog({
  open,
  onOpenChange,
  mode,
  name,
  planLabel,
  fullKey,
}: KeySecretDialogProps) {
  const [setupOpen, setSetupOpen] = useState(false)
  const keyCopy = useCopyToClipboard()
  const setupCopy = useCopyToClipboard()

  const handleOpenChange = (next: boolean) => {
    if (!next) setSetupOpen(false)
    onOpenChange(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <AlertDialogTitle className="text-[15px]">
            {mode === 'created' ? 'Key created' : 'Key rotated'}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {mode === 'created'
              ? 'Copy your new API key now; it will not be shown again.'
              : 'Copy your new API key now; the previous key no longer works.'}
          </AlertDialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label="Close"
            onClick={() => handleOpenChange(false)}
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <IconCheck className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-medium">Copy this key now</p>
                <p className="text-[13px] text-muted-foreground">
                  {mode === 'created'
                    ? "It won't be shown again."
                    : "The previous key has stopped working. This one won't be shown again."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code
                className="min-w-0 flex-1 basis-56 rounded-md border border-input bg-muted/40 px-3 py-2.5 font-mono text-[13px] break-all select-all"
                aria-label={`${name} API key`}
              >
                {fullKey}
              </code>
              <Button className="shrink-0" onClick={() => keyCopy.copy(fullKey)}>
                <CopyIcon copied={keyCopy.copied} />
                {keyCopy.copied ? 'Copied' : 'Copy key'}
              </Button>
            </div>
          </div>

          <dl className="divide-y divide-border rounded-md border border-border text-[12.5px]">
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="truncate font-medium" title={name}>
                {name}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{planLabel ?? 'No plan'}</dd>
            </div>
          </dl>

          <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="flex items-center justify-between gap-2 px-1.5 py-1.5">
                <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-[12.5px] font-medium hover:bg-muted/40">
                  <IconChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground',
                      setupOpen ? 'rotate-0' : '-rotate-90'
                    )}
                    aria-hidden
                  />
                  Setup message
                </CollapsibleTrigger>
                <Button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setupCopy.copy(setupMessage(fullKey))}
                  size="sm"
                  variant="ghost"
                >
                  <CopyIcon copied={setupCopy.copied} />
                  {setupCopy.copied ? 'Copied' : 'Copy setup message'}
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="overflow-x-auto border-t border-border bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                  {setupMessage(fullKey)}
                </pre>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <div className="flex justify-end border-t border-border bg-muted/40 px-5 py-3">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
