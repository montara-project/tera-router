import { IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'

import { NumberInput } from '@/components/block/common/number-input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Settings card: a header (icon, title, muted line, optional right slot) over its rows. */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  aside,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  /** Right side of the header, e.g. a status chip or a button. */
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold">{title}</h3>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {aside}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

interface SettingRowProps {
  title: string
  description?: React.ReactNode
  badge?: React.ReactNode
  /** Longer explanation behind an info button next to the title. */
  info?: string
  /** Indents a row that depends on the one above it. */
  nested?: boolean
  /** Puts the control under the text instead of beside it (wide segmented controls). */
  stacked?: boolean
  children: React.ReactNode
}

export default function SettingRow({
  title,
  description,
  badge,
  info,
  nested,
  stacked,
  children,
}: SettingRowProps) {
  return (
    // Wide controls drop below the text on narrow cards instead of squeezing
    // the title to one word per line.
    <div
      className={cn(
        'flex flex-wrap justify-between gap-x-6 gap-y-3 py-3.5 pr-4',
        nested ? 'pl-9' : 'pl-4',
        stacked ? 'flex-col' : 'items-center'
      )}
    >
      <div className={cn('min-w-0', !stacked && 'flex-1 basis-48')}>
        <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          {title}
          {info ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${title}`}
                  className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <IconInfoCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">{info}</TooltipContent>
            </Tooltip>
          ) : null}
          {badge}
        </p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Number input with a unit inside its right edge, e.g. "60 sec". */
export function UnitInput({
  label,
  unit,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  unit: string
  value: number
  min?: number
  max?: number
  /** Called with a valid number when the field loses focus. */
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  // A saved value from outside replaces whatever was typed.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setDraft(String(value))
  }

  return (
    <div className="relative w-28">
      <NumberInput
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        className="pr-11"
        onValueChange={setDraft}
        onBlur={() => {
          const next = Number(draft)
          const ok =
            draft !== '' && (min === undefined || next >= min) && (max === undefined || next <= max)
          if (ok && next !== value) onCommit(next)
          else setDraft(String(value))
        }}
      />
      <span
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
        aria-hidden
      >
        {unit}
      </span>
    </div>
  )
}

interface SegmentedControlProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  'aria-label'?: string
}

export function SegmentedControl({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-muted/40 p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center rounded-sm px-2.5 text-xs font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-xs'
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
