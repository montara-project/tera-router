import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs',
        className
      )}
      {...props}
    />
  )
}

const SHEET_SIZE_CLASSES = {
  sm: 'data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm',
  md: 'data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md',
  lg: 'data-[side=left]:sm:max-w-lg data-[side=right]:sm:max-w-lg',
  xl: 'data-[side=left]:sm:max-w-2xl data-[side=right]:sm:max-w-2xl',
} as const

function SheetContent({
  className,
  children,
  side = 'right',
  size = 'sm',
  showCloseButton = true,
  forceMount,
  showOverlay = true,
  asChild,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Max width of left/right sheets on sm+ screens; ignored for top/bottom sheets. */
  size?: keyof typeof SHEET_SIZE_CLASSES
  showCloseButton?: boolean
  /** Keep portal, overlay, and content mounted across open/close so a
   * motion/react AnimatePresence (not Radix presence) owns the exit
   * animation. The caller conditionally renders SheetContent themselves. */
  forceMount?: boolean
  /** Skip the built-in overlay because the caller renders their own
   * (animated) SheetOverlay. */
  showOverlay?: boolean
}) {
  return (
    <SheetPortal forceMount={forceMount}>
      {showOverlay && <SheetOverlay forceMount={forceMount} />}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        asChild={asChild}
        className={cn(
          'bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b',
          SHEET_SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {asChild ? (
          // Radix Slot requires exactly one element child, so the built-in
          // close button can only ride along on non-asChild content.
          children
        ) : (
          <>
            {children}
            {showCloseButton && (
              <SheetPrimitive.Close data-slot="sheet-close" asChild>
                <Button variant="ghost" className="absolute top-4 right-4" size="icon">
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetPrimitive.Close>
            )}
          </>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-medium', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
