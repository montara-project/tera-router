import { IconCopy, IconEye, IconEyeOff, IconMessageChatbot } from '@tabler/icons-react'
import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Badge, BadgeDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

// Mounted on first open, then kept so its exit animation plays: keeps motion
// out of the route chunk and avoids one sheet root per never-tested card.
const ModelTestSheet = lazy(() => import('@/components/block/provider-detail/model-test-sheet'))

export default function ModelCard({
  providerSlug,
  providerId,
  variant,
  model,
  selected,
  onToggleSelect,
  onToggleState,
}: {
  providerSlug: string
  /** matches the API path key: slug for catalog providers, uuid for customs */
  providerId: string
  variant: 'catalog' | 'custom'
  model: Models.ProviderModel
  selected: boolean
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleState: (id: string, state: Models.ProviderModelState) => void
}) {
  const active = model.state === 'active'
  const composite = `${providerSlug}/${model.id}`
  const [testOpen, setTestOpen] = useState(false)
  const [testMounted, setTestMounted] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(model.id)
      toast.success('Model ID copied')
    } catch {
      toast.error('Failed to copy model ID')
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${active ? 'bg-background' : 'bg-muted/20'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            size="sm"
            checked={selected}
            onCheckedChange={(checked) => onToggleSelect(model.id, checked === true)}
            aria-label={`Select ${model.id}`}
          />
          <Badge variant={active ? 'success' : 'secondary'} appearance="light" size="sm">
            <BadgeDot />
            {active ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <Badge variant="outline" size="sm">
          llm
        </Badge>
      </div>
      <p className="mt-3 truncate text-sm font-semibold" title={model.id}>
        {model.id}
      </p>
      <p
        className="mt-1.5 truncate rounded-md bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground"
        title={composite}
      >
        {composite}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
        <span className={`text-xs ${active ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {active ? 'Enabled in catalog' : 'Excluded from routing'}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Test ${model.id}`}
            onClick={() => {
              setTestMounted(true)
              setTestOpen(true)
            }}
          >
            <IconMessageChatbot />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={active ? `Disable ${model.id}` : `Enable ${model.id}`}
            onClick={() => onToggleState(model.id, active ? 'disabled' : 'active')}
          >
            {active ? <IconEye /> : <IconEyeOff />}
          </Button>
          <Button size="icon" variant="ghost" aria-label={`Copy ${model.id}`} onClick={copy}>
            <IconCopy />
          </Button>
        </div>
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
    </div>
  )
}
