import { cn } from '@/lib/utils'

interface SettingRowProps {
  title: string
  description?: string
  children: React.ReactNode
}

export default function SettingRow({ title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

interface SegmentedControlProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  return (
    <div className="flex items-center rounded-lg border border-border p-0.5">
      {options.map((option) => {
        const active = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-xs transition-colors',
              active
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
