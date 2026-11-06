'use client'

import type { VariantProps } from 'class-variance-authority'

import React from 'react'
import { NumericFormat, PatternFormat } from 'react-number-format'

import { Input, type inputVariants } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface NumberInputProps extends VariantProps<typeof inputVariants> {
  id?: string
  name?: string
  value?: string | number
  /** uncontrolled start value; prefer value + onValueChange */
  defaultValue?: string | number
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  /** the raw number as text, without separators, prefix or suffix ("1234.5") */
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  /** groups digits in threes: 1,000,000 (default on) */
  thousandSeparator?: boolean
  /** decimals allowed; 0 = whole numbers (default), 2 when currency */
  decimalScale?: number
  /** pads to decimalScale, e.g. 50 → 50.00 (default on for currency) */
  fixedDecimalScale?: boolean
  /** USD amount: "$" prefix and 2 decimals unless decimalScale says otherwise */
  currency?: boolean
  prefix?: string
  suffix?: string
  allowNegative?: boolean
  disabled?: boolean
  format?: string // For pattern format like phone numbers
  mask?: string
  type?: 'numeric' | 'pattern'
  min?: number
  max?: number
  maxLength?: number
  inputMode?: 'numeric' | 'decimal'
  'aria-label'?: string
  'aria-invalid'?: boolean
}

/**
 * Number input on the shared Input styles, formatted as the user types.
 * Values reach onValueChange unformatted, so form schemas keep parsing plain
 * numbers.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      onValueChange,
      className,
      thousandSeparator = true,
      currency = false,
      decimalScale = currency ? 2 : 0,
      fixedDecimalScale = currency && decimalScale === 2,
      prefix = currency ? '$' : undefined,
      allowNegative = false,
      format,
      mask,
      type = 'numeric',
      inputMode,
      ...props
    },
    ref
  ) => {
    const shared = {
      ...props,
      getInputRef: ref,
      customInput: Input,
      className: cn('tabular-nums', className),
      onValueChange: (values: { value: string }) => onValueChange?.(values.value),
    }

    if (type === 'pattern' && format) {
      return <PatternFormat {...shared} format={format} mask={mask} inputMode="numeric" />
    }

    return (
      <NumericFormat
        {...shared}
        thousandSeparator={thousandSeparator}
        decimalScale={decimalScale}
        fixedDecimalScale={fixedDecimalScale}
        prefix={prefix}
        allowNegative={allowNegative}
        inputMode={inputMode ?? (decimalScale > 0 ? 'decimal' : 'numeric')}
      />
    )
  }
)

NumberInput.displayName = 'NumberInput'

export { NumberInput }

/*
Using NumberInput:
## Whole number (1,000,000)
  <NumberInput value={tokens} onValueChange={setTokens} placeholder="100,000" />

## Currency ($1,250.00)
  <NumberInput value={usd} onValueChange={setUsd} currency placeholder="50.00" />

## Small currency rate ($0.075, not padded)
  <NumberInput value={rate} onValueChange={setRate} currency decimalScale={6} />

## Percentage
  <NumberInput
    value={percentage}
    onValueChange={setPercentage}
    suffix="%"
    placeholder="Enter percentage"
    decimalScale={2}
    thousandSeparator={false}
  />

## Phone Number
  <NumberInput
    type="pattern"
    format="(###) ###-####"
    mask="_"
    value={phone}
    onValueChange={setPhone}
    placeholder="(555) 123-4567"
  />

## Credit Card
  <NumberInput
    type="pattern"
    format="#### #### #### ####"
    mask="_"
    value={creditCard}
    onValueChange={setCreditCard}
    placeholder="1234 5678 9012 3456"
  />
*/
