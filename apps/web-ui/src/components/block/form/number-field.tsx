'use client'

import { useSelector } from '@tanstack/react-form'

import { NumberInput, type NumberInputProps } from '@/components/block/common/number-input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputWrapper } from '@/components/ui/input'
import { useFieldContext } from '@/hooks/form-context'

interface NumberFieldProps extends NumberInputProps {
  label?: string
  asterisk?: boolean
  /** Muted note right of the label, e.g. "Optional", as in TextField. */
  hint?: string
}

/** Form field around NumberInput, laid out like TextField. */
export default function NumberField({ label, asterisk, hint, ...props }: NumberFieldProps) {
  const field = useFieldContext<string>()
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
      <InputWrapper variant="lg">
        <NumberInput
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onValueChange={(value) => field.handleChange(value)}
          aria-invalid={isInvalid}
          variant="lg"
          {...props}
        />
      </InputWrapper>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}
