'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

type ButtonGroupVariant = 'default' | 'outline'
type ButtonGroupSize = 'lg' | 'md' | 'sm' | 'xs'

// Variants for ButtonGroup
const buttonGroupVariants = cva('flex items-center shrink-0', {
  variants: {
    variant: {
      default: 'bg-accent',
      outline: 'border border-border',
    },
    size: {
      lg: 'gap-2.5',
      md: 'gap-2',
      sm: 'gap-1.5',
      xs: 'gap-1',
    },
  },
  compoundVariants: [
    { variant: 'default', size: 'lg', className: 'p-1.5 rounded-lg' },
    { variant: 'default', size: 'md', className: 'p-1 rounded-lg' },
    { variant: 'default', size: 'sm', className: 'p-1 rounded-md' },
    { variant: 'default', size: 'xs', className: 'p-1 rounded-md' },

    { variant: 'outline', size: 'lg', className: 'p-1.5 rounded-lg' },
    { variant: 'outline', size: 'md', className: 'p-1 rounded-lg' },
    { variant: 'outline', size: 'sm', className: 'p-1 rounded-md' },
    { variant: 'outline', size: 'xs', className: 'p-1 rounded-md' },
  ],
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

// Variants for ButtonGroupItem
const buttonGroupItemVariants = cva(
  'shrink-0 cursor-pointer whitespace-nowrap inline-flex justify-center items-center font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'text-muted-foreground hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs data-[state=on]:shadow-black/5',
        outline:
          'text-accent-foreground hover:text-foreground hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-foreground',
      },
      size: {
        lg: 'gap-2.5 [&_svg]:size-5 text-sm',
        md: 'gap-2 [&_svg]:size-4 text-sm',
        sm: 'gap-1.5 [&_svg]:size-3.5 text-xs',
        xs: 'gap-1 [&_svg]:size-3.5 text-xs',
      },
    },
    compoundVariants: [
      { variant: 'default', size: 'lg', className: 'py-2.5 px-4 rounded-md' },
      { variant: 'default', size: 'md', className: 'py-1.5 px-3 rounded-md' },
      { variant: 'default', size: 'sm', className: 'py-1.5 px-2.5 rounded-sm' },
      { variant: 'default', size: 'xs', className: 'py-1 px-2 rounded-sm' },

      { variant: 'outline', size: 'lg', className: 'py-2.5 px-4 rounded-md' },
      { variant: 'outline', size: 'md', className: 'py-1.5 px-3 rounded-md' },
      { variant: 'outline', size: 'sm', className: 'py-1.5 px-2.5 rounded-sm' },
      { variant: 'outline', size: 'xs', className: 'py-1 px-2 rounded-sm' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

// Context
type ButtonGroupContextType = {
  variant?: ButtonGroupVariant
  size?: ButtonGroupSize
}
const ButtonGroupContext = React.createContext<ButtonGroupContextType>({
  variant: 'default',
  size: 'md',
})

// Components
function ButtonGroup({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof buttonGroupVariants>) {
  return (
    <ButtonGroupContext.Provider value={{ variant: variant || 'default', size: size || 'md' }}>
      <ToggleGroupPrimitive.Root
        data-slot="button-group"
        className={cn(buttonGroupVariants({ variant, size }), className)}
        {...props}
      />
    </ButtonGroupContext.Provider>
  )
}

function ButtonGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const { variant, size } = React.useContext(ButtonGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="button-group-item"
      className={cn(buttonGroupItemVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { ButtonGroup, ButtonGroupItem }
