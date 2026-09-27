import { IconBox, IconFileText, IconKey, IconNetwork, IconStack2, IconWorld } from '@tabler/icons-react'

import type { GuardrailsScope } from '@/lib/api/models/guardrails'

import { cn } from '@/lib/utils'

export const GUARDRAILS_TABS: {
  value: GuardrailsScope | 'audit'
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}[] = [
  { value: 'global', label: 'Global', icon: IconWorld },
  { value: 'provider', label: 'Providers', icon: IconNetwork },
  { value: 'model', label: 'Models', icon: IconBox },
  { value: 'chain', label: 'Chains', icon: IconStack2 },
  { value: 'key', label: 'API Keys', icon: IconKey },
  { value: 'audit', label: 'Audit Logs', icon: IconFileText },
]

interface GuardrailsTabsProps {
  value: GuardrailsScope | 'audit'
  onChange: (value: GuardrailsScope | 'audit') => void
}

export default function GuardrailsTabs({ value, onChange }: GuardrailsTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {GUARDRAILS_TABS.map((tab) => {
        const active = tab.value === value

        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-emerald-600 text-foreground'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
