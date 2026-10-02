'use client'

import { useSelector } from '@tanstack/react-form'

import type { Option } from '@/types/select'

import ComboboxInput from '@/components/block/common/combobox-input'
import { Field, FieldLabel } from '@/components/ui/field'
import { useFieldContext } from '@/hooks/form-context'
import { cn } from '@/lib/utils'

interface ComboboxFieldProps<TData> {
  label: string
  options: Option<TData>[]
  defaultValues?: string[]
  onSelect?: (value: string) => void
  asterisk?: boolean
  /** true keeps several picks as badges; false replaces the single value */
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  /** keeps the label for assistive tech only (compact inline rows) */
  hideLabel?: boolean
}

export default function ComboboxField<TData>({
  label,
  options,
  defaultValues,
  onSelect,
  asterisk = false,
  multiple = false,
  placeholder,
  disabled = false,
  hideLabel = false,
}: ComboboxFieldProps<TData>) {
  const field = useFieldContext<string>()
  const errors = useSelector(field.store, (state) => state.meta.errors)

  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name} className={cn('gap-1', hideLabel && 'sr-only')}>
        {label}
        {asterisk && <span className="text-destructive">*</span>}
      </FieldLabel>
      <ComboboxInput
        label={label}
        defaultValues={defaultValues || []}
        // live selection so external field changes (e.g. a reset) are reflected
        selection={multiple ? undefined : field.state.value ? [field.state.value] : []}
        options={options}
        disabled={disabled}
        multiple={multiple}
        placeholder={placeholder}
        onBlur={field.handleBlur}
        onSelect={(value: any) => {
          const next = multiple ? value : (value[0] ?? '')
          field.handleChange(next)
          onSelect?.(next)
        }}
      />
    </Field>
  )
}
