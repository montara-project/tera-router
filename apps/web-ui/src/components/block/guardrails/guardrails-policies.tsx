import { IconPlus, IconShield } from '@tabler/icons-react'

import type { GuardrailPolicy } from '@/lib/api/models/guardrails'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

import PolicyRow from './policy-row'

interface GuardrailsPoliciesProps {
  policies: GuardrailPolicy[]
  externalDetectors: boolean
  onToggleExternalDetectors: (checked: boolean) => void
  onCreate: () => void
  onTogglePolicy: (id: string, enabled: boolean) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

/** Policies tab: the tenant-wide detector switch plus every stored policy. */
export default function GuardrailsPolicies({
  policies,
  externalDetectors,
  onToggleExternalDetectors,
  onCreate,
  onTogglePolicy,
  onEdit,
  onDelete,
}: GuardrailsPoliciesProps) {
  return (
    <div className="flex flex-col gap-4">
      {policies.length === 0 ? (
        <section className="flex flex-col items-center rounded-lg border border-border bg-card px-6 py-12 text-center">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
            <IconShield className="size-5" aria-hidden />
          </span>
          <h2 className="mt-3.5 text-sm font-semibold">No guardrail policies yet</h2>
          <p className="text-muted-foreground mt-1 text-[13px]">
            Requests pass through unchecked until a policy exists.
          </p>
          <Button className="mt-4" onClick={onCreate}>
            <IconPlus />
            Create global policy
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          {policies.map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              onToggle={(enabled) => onTogglePolicy(policy.id, enabled)}
              onEdit={() => onEdit(policy.id)}
              onDelete={() => onDelete(policy.id)}
            />
          ))}
        </div>
      )}

      <section className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
            <IconShield className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Allow external detector engines</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Presidio, [OI] Moderation and embedding engines may receive prompt text. When off,
              every detector runs natively inside the gateway.
            </p>
          </div>
        </div>
        <Switch
          checked={externalDetectors}
          onCheckedChange={onToggleExternalDetectors}
          aria-label="Allow external detector engines"
        />
      </section>
    </div>
  )
}
