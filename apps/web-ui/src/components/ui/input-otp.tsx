'use client'

import { OTPInput, OTPInputContext } from 'input-otp'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Compound API mirrors HeroUI's InputOTP: <InputOTP><InputOTP.Group><InputOTP.Slot index={0} /></InputOTP.Group></InputOTP>
function InputOTPRoot({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        'group/otp flex items-center gap-2 has-disabled:opacity-60',
        containerClassName
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<'div'> & { index: number }) {
  const { char, hasFakeCaret, isActive } = React.useContext(OTPInputContext).slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      data-filled={!!char}
      className={cn(
        `
          relative flex size-10 items-center justify-center rounded-md border border-input bg-background
          font-mono text-base font-medium text-foreground shadow-xs shadow-black/5 transition-[color,box-shadow]
          data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/30
          group-has-[[aria-invalid=true]]/otp:border-destructive/60 group-has-[[aria-invalid=true]]/otp:ring-destructive/10
          dark:group-has-[[aria-invalid=true]]/otp:border-destructive dark:group-has-[[aria-invalid=true]]/otp:ring-destructive/20
        `,
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      className={cn('h-0.5 w-2.5 rounded-full bg-border', className)}
      {...props}
    />
  )
}

const InputOTP = Object.assign(InputOTPRoot, {
  Group: InputOTPGroup,
  Slot: InputOTPSlot,
  Separator: InputOTPSeparator,
})

export { REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
