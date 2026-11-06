import { IconCheck, IconCopy, IconLoader2, IconMessageChatbot } from '@tabler/icons-react'
import { lazy, Suspense, useState } from 'react'

import type { ModelTestStatus } from '@/components/block/provider-detail/models-panel'
import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

// Mounted on first open, then kept so its exit animation plays: keeps motion
// out of the route chunk and avoids one sheet root per never-tested row.
const ModelTestSheet = lazy(() => import('@/components/block/provider-detail/model-test-sheet'))

/** "Test all" outcome next to the model name. */
export function TestBadge({ result }: { result?: ModelTestStatus }) {
  if (!result) return null
  if (result.state === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
        <IconLoader2 className="size-3 animate-spin" aria-hidden />
        Testing
      </span>
    )
  }
  return result.state === 'success' ? (
    <span className="rounded-sm bg-emerald-500/10 px-1.5 text-[11.5px] font-medium text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400">
      OK · {result.latencyMs} ms
    </span>
  ) : (
    <span
      className="rounded-sm bg-destructive/10 px-1.5 text-[11.5px] font-medium text-red-700 ring-1 ring-destructive/25 ring-inset dark:text-red-400"
      title={result.detail}
    >
      Failed
    </span>
  )
}

/** "provider/model" with a copy button: the name clients call the model by. */
export function RouteAsCell({ routeAs }: { routeAs: string }) {
  const { copy, copied } = useCopyToClipboard()
  return (
    <button
      type="button"
      onClick={() => copy(routeAs)}
      aria-label={copied ? `${routeAs} copied` : `Copy ${routeAs}`}
      title={routeAs}
      className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground"
    >
      <span className="truncate">{routeAs}</span>
      {copied ? (
        <IconCheck className="size-3 shrink-0" aria-hidden />
      ) : (
        <IconCopy className="size-3 shrink-0" aria-hidden />
      )}
    </button>
  )
}

/** The row's test button, which opens the test sheet, and its enabled switch. */
export function ModelActionsCell({
  providerSlug,
  providerId,
  variant,
  model,
  onToggleState,
}: {
  providerSlug: string
  /** matches the API path key: slug for catalog providers, uuid for customs */
  providerId: string
  variant: 'catalog' | 'custom'
  model: Models.ProviderModel
  onToggleState: (id: string, state: Models.ProviderModelState) => void
}) {
  const [testOpen, setTestOpen] = useState(false)
  const [testMounted, setTestMounted] = useState(false)

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`Test ${model.id}`}
          onClick={() => {
            setTestMounted(true)
            setTestOpen(true)
          }}
        >
          <IconMessageChatbot />
        </Button>
        <Switch
          checked={model.state === 'active'}
          onCheckedChange={(on) => onToggleState(model.id, on ? 'active' : 'disabled')}
          aria-label={`${model.id} enabled`}
        />
      </div>
      {testMounted && (
        <Suspense fallback={null}>
          <ModelTestSheet
            open={testOpen}
            onOpenChange={setTestOpen}
            variant={variant}
            providerId={providerId}
            providerSlug={providerSlug}
            modelId={model.id}
          />
        </Suspense>
      )}
    </>
  )
}
