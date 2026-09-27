import { IconShieldCheck, IconTrash } from '@tabler/icons-react'

import type { GuardrailPolicy } from '@/lib/api/models/guardrails'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

const EDIT_BUTTON_CLASS =
  'bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-600 dark:hover:bg-emerald-600/90'

interface PolicyRowProps {
  policy: GuardrailPolicy
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export default function PolicyRow({ policy, onToggle, onEdit, onDelete }: PolicyRowProps) {
  const scopeLine = [
    'scope',
    policy.scope,
    ...(policy.target ? [policy.target] : []),
    ...policy.protections,
  ].join(' · ')

  return (
    <Card className="bg-background">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <IconShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{policy.name}</p>
            {policy.enabled ? (
              <Badge variant="success" appearance="light" size="sm">
                Active
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 truncate text-xs">{scopeLine}</p>
        </div>

        <Switch
          checked={policy.enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${policy.name}`}
          className="data-[state=checked]:bg-amber-600"
        />
        <Button size="sm" className={EDIT_BUTTON_CLASS} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="secondary" size="icon" aria-label={`Delete ${policy.name}`} onClick={onDelete}>
          <IconTrash className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
