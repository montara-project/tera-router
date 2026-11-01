import { IconCheck, IconChevronDown, IconCopy } from '@tabler/icons-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
  const base = `${env.VITE_API_URL.replace(/\/+$/, '')}/v1`
  return [
    `Base URL: ${base}`,
    '',
    `curl ${base}/chat/completions \\`,
    `  -H "Authorization: Bearer ${fullKey}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
  ].join('\n')
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'created' ? 'Key created' : 'Key rotated'}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'created'
              ? 'Copy your new API key now; it will not be shown again.'
              : 'Copy your new API key now; the previous key no longer works.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <IconCheck className="size-3.5" />
            </span>
            <div>
              <p className="text-sm font-medium">Copy this key now</p>
              <p className="text-muted-foreground text-sm">It won&apos;t be shown again.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={fullKey}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono"
            />
            <Button className="shrink-0" onClick={() => keyCopy.copy(fullKey)}>
              <span className="grid *:col-start-1 *:row-start-1">
                <IconCopy
                  className={cn(
                    'transition-all duration-200',
                    keyCopy.copied && 'scale-50 opacity-0'
                  )}
                />
                <IconCheck
                  className={cn(
                    'text-emerald-600 transition-all duration-200 dark:text-emerald-300',
                    !keyCopy.copied && 'scale-50 opacity-0'
                  )}
                />
              </span>
              {keyCopy.copied ? 'Copied!' : 'Copy key'}
            </Button>
          </div>

          <div className="divide-y overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-muted-foreground text-sm">Name</span>
              <span className="text-sm font-medium">{name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-muted-foreground text-sm">Plan</span>
              <span className="text-sm font-medium">{planLabel ?? 'No plan'}</span>
            </div>
          </div>

          <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
            <div className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between gap-3 pe-2.5">
                <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-medium hover:bg-accent/50">
                  <IconChevronDown
                    className={cn(
                      'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
                      setupOpen && 'rotate-180'
                    )}
                  />
                  Setup message
                </CollapsibleTrigger>
                <Button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setupCopy.copy(setupMessage(fullKey))}
                  size="sm"
                  variant="ghost"
                >
                  <span className="grid *:col-start-1 *:row-start-1">
                    <IconCopy
                      className={cn(
                        'transition-all duration-200',
                        setupCopy.copied && 'scale-50 opacity-0'
                      )}
                    />
                    <IconCheck
                      className={cn(
                        'text-emerald-600 transition-all duration-200 dark:text-emerald-300',
                        !setupCopy.copied && 'scale-50 opacity-0'
                      )}
                    />
                  </span>
                  {setupCopy.copied ? 'Copied!' : 'Copy setup message'}
                </Button>
              </div>
              <CollapsibleContent>
                <pre className="bg-muted/50 overflow-x-auto border-t px-4 py-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                  {setupMessage(fullKey)}
                </pre>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
