import { IconPencil, IconShieldCheck, IconTrash } from '@tabler/icons-react'

import type { GuardrailPolicy } from '@/lib/api/models/guardrails'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface PolicyRowProps {
  policy: GuardrailPolicy
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

/** One stored policy: scope line, its detectors, and the enabled switch. */
export default function PolicyRow({ policy, onToggle, onEdit, onDelete }: PolicyRowProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-card px-4 py-3">
      <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md">
        <IconShieldCheck className="size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 basis-48">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{policy.name}</p>
          {policy.enabled ? null : (
            <Badge variant="secondary" size="sm">
              Disabled
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {[
            policy.scope,
            ...(policy.target ? [policy.target] : []),
            ...(policy.protections.length > 0
              ? [policy.protections.join(' · ')]
              : ['no detectors']),
          ].join(' · ')}
        </p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Switch
          checked={policy.enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${policy.name}`}
        />
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <IconPencil />
          Edit
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${policy.name}`} onClick={onDelete}>
          <IconTrash />
        </Button>
      </div>
    </section>
  )
}
