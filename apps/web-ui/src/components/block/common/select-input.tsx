'use client'

import { IconArrowDown } from '@tabler/icons-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Option {
  label: string
  value: string
  icon?: typeof IconArrowDown
  disabled?: boolean
}

interface SelectInputProps {
  options: Option[]
  onSelect: (value: string) => void
  /** Controlled value; leave unset and use defaultValue for an uncontrolled select. */
  value?: string
  defaultValue?: string
  /** Shown while no option is selected. */
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}

// Radix Select reserves "" for "no value", but options such as "All
// providers" or "No plan" use it; they travel under this stand-in instead.
const EMPTY = '__empty__'

export default function SelectInput({
  options,
  onSelect,
  value,
  defaultValue,
  placeholder,
  className,
  id,
  'aria-label': ariaLabel,
  size,
  disabled,
}: SelectInputProps) {
  const hasEmpty = options.some((o) => o.value === '')
  const toInner = (v: string | undefined) => (v === '' && hasEmpty ? EMPTY : v)

  return (
    <Select
      value={toInner(value)}
      defaultValue={toInner(defaultValue)}
      onValueChange={(v) => onSelect(v === EMPTY ? '' : v)}
      disabled={disabled}
      indicatorPosition="right"
    >
      <SelectTrigger id={id} aria-label={ariaLabel} size={size} className={className ?? 'w-50'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value === '' ? EMPTY : option.value}
            disabled={option.disabled}
          >
            {option.icon && <option.icon className="mr-2 h-4 w-4" />}
            <span>{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
