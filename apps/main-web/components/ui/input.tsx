'use client'

// ReUI v1 Input (https://v1.reui.io/docs/input), mapped to this site's tokens.
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const inputVariants = cva(
  `
    flex w-full bg-canvas border border-line shadow-xs shadow-black/5 transition-[color,box-shadow] text-ink placeholder:text-faint
    focus-visible:ring-accent/30 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px]
    disabled:cursor-not-allowed disabled:opacity-60
  `,
  {
    variants: {
      variant: {
        lg: 'h-10 px-4 text-sm rounded-md',
        md: 'h-9 px-3 text-sm rounded-md',
        sm: 'h-8 px-2.5 text-sm rounded-md',
      },
    },
    defaultVariants: {
      variant: 'md',
    },
  }
)

const inputWrapperVariants = cva(
  `
    flex items-center
    has-[:focus-visible]:ring-accent/30
    has-[:focus-visible]:border-accent
    has-[:focus-visible]:outline-none
    has-[:focus-visible]:ring-[3px]

    [&_[data-slot=input]]:flex
    [&_[data-slot=input]]:w-full
    [&_[data-slot=input]]:outline-none
    [&_[data-slot=input]]:transition-colors
    [&_[data-slot=input]]:text-ink
    [&_[data-slot=input]]:placeholder:text-faint
    [&_[data-slot=input]]:border-0
    [&_[data-slot=input]]:bg-transparent
    [&_[data-slot=input]]:p-0
    [&_[data-slot=input]]:shadow-none
    [&_[data-slot=input]]:focus-visible:ring-0
    [&_[data-slot=input]]:h-auto

    [&_svg]:text-faint
    [&_svg]:shrink-0
  `,
  {
    variants: {
      variant: {
        sm: 'gap-1.5 [&_svg:not([class*=size-])]:size-4',
        md: 'gap-1.5 [&_svg:not([class*=size-])]:size-4',
        lg: 'gap-1.5 [&_svg:not([class*=size-])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'md',
    },
  }
)

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

/** A field box that holds an icon and a bare Input, focused as one control. */
function InputWrapper({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputWrapperVariants>) {
  return (
    <div
      data-slot="input-wrapper"
      className={cn(inputVariants({ variant }), inputWrapperVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input, InputWrapper }
