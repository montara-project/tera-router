import { cn } from '@/lib/utils'

export const HEALTH_TABS = [
  { value: 'providers', label: 'Providers' },
  { value: 'models', label: 'Models' },
  { value: 'chains', label: 'Chains' },
  { value: 'probes', label: 'Probes' },
] as const

export type HealthTab = (typeof HEALTH_TABS)[number]['value']

interface ProviderHealthTabsProps {
  value: HealthTab
  onChange: (value: HealthTab) => void
}

export default function ProviderHealthTabs({ value, onChange }: ProviderHealthTabsProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {HEALTH_TABS.map((tab) => {
        const active = tab.value === value

        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-accent font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
