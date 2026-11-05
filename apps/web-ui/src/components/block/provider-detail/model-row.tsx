import { IconCheck, IconCopy, IconLoader2, IconMessageChatbot } from '@tabler/icons-react'
import { lazy, Suspense, useState } from 'react'

import type { ModelTestStatus } from '@/components/block/provider-detail/models-panel'
import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

// Mounted on first open, then kept so its exit animation plays: keeps motion
// out of the route chunk and avoids one sheet root per never-tested row.
const ModelTestSheet = lazy(() => import('@/components/block/provider-detail/model-test-sheet'))

/** "Test all" outcome next to the model name. */
function TestBadge({ result }: { result?: ModelTestStatus }) {
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

export default function ModelRow({
  providerSlug,
  providerId,
  variant,
  model,
  selected,
  onToggleSelect,
  onToggleState,
  testResult,
}: {
  providerSlug: string
  /** matches the API path key: slug for catalog providers, uuid for customs */
  providerId: string
  variant: 'catalog' | 'custom'
  model: Models.ProviderModel
  selected: boolean
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleState: (id: string, state: Models.ProviderModelState) => void
  /** Outcome from the catalog's "Test all" run; absent when not tested. */
  testResult?: ModelTestStatus
}) {
  const active = model.state === 'active'
  const routeAs = `${providerSlug}/${model.id}`
  const [testOpen, setTestOpen] = useState(false)
  const [testMounted, setTestMounted] = useState(false)
  const { copy, copied } = useCopyToClipboard()

  return (
    <tr className="border-b border-border last:border-0">
      <td className="w-12 px-4 py-2">
        <Checkbox
          size="sm"
          checked={selected}
          onCheckedChange={(checked) => onToggleSelect(model.id, checked === true)}
          aria-label={`Select ${model.id}`}
        />
      </td>
      <td className="max-w-0 py-2 pe-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate font-medium ${active ? '' : 'text-muted-foreground'}`}
            title={model.id}
          >
            {model.id}
          </span>
          <TestBadge result={testResult} />
        </div>
      </td>
      <td className="px-4 py-2 text-muted-foreground">llm</td>
      <td className="max-w-0 px-4 py-2">
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
      </td>
      <td className="px-4 py-2">
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
            checked={active}
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
      </td>
    </tr>
  )
}
