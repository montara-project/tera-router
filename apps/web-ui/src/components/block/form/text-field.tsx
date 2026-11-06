'use client'

import type { VariantProps } from 'class-variance-authority'
import type { ChangeEvent } from 'react'

import { IconCheck } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'

import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input, inputVariants, InputWrapper } from '@/components/ui/input'
import { useFieldContext } from '@/hooks/form-context'

type InputProps = React.ComponentProps<'input'> & VariantProps<typeof inputVariants>

type TextFieldProps = InputProps & {
  label?: string
  onChange?: (value: string) => void
  icon?: typeof IconCheck
  asterisk?: boolean
  /** Muted note right of the label, e.g. "Required" or "Optional". */
  hint?: string
}

export default function TextField({
  label,
  placeholder,
  onChange,
  disabled,
  asterisk = false,
  hint,
  icon: Icon,
  variant = 'lg',
  ...props
}: TextFieldProps) {
  const field = useFieldContext<string | number>()
  const errors = useSelector(field.store, (state) => state.meta.errors)

  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={field.name} className="gap-1">
          {label}
          {asterisk && <span className="text-destructive">*</span>}
        </FieldLabel>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <InputWrapper variant={variant}>
        {Icon && <Icon />}
        <Input
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            field.handleChange(e.target.value)
            onChange?.(e.target.value)
          }}
          aria-invalid={isInvalid}
          placeholder={placeholder}
          variant={variant}
          disabled={disabled}
          {...props}
        />
      </InputWrapper>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
