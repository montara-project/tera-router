'use client'

import { IconLoader2, IconX } from '@tabler/icons-react'
import React, { useMemo } from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SimpleAlertScrollableDialogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Small icon drawn before the title. */
  icon?: React.ElementType
  description?: string
  onSubmit: React.SubmitEventHandler<HTMLFormElement> | undefined
  children: React.ReactNode
  cancelText?: string
  confirmText?: string
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg' | '3xl' | 'xl'
}

export default function SimpleAlertScrollableDialogForm({
  open,
  onOpenChange,
  title,
  icon: Icon,
  description,
  onSubmit,
  children,
  cancelText = 'Cancel',
  confirmText = 'Save',
  loading = false,
  disabled = false,
  size = 'xl',
}: SimpleAlertScrollableDialogFormProps) {
  const sizeClass = useMemo(() => {
    if (size === 'sm') {
      return 'max-w-md'
    }
    if (size === 'md') {
      return 'max-w-lg'
    }
    if (size === 'lg') {
      return 'max-w-2xl'
    }
    if (size === '3xl') {
      return 'max-w-3xl'
    }

    return 'max-w-4xl'
  }, [size])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn('flex max-h-[90vh] flex-col overflow-hidden p-0', sizeClass)}
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
            <AlertDialogHeader className="min-w-0 flex-1">
              <AlertDialogTitle className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
                {Icon ? (
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className={cn(!description && 'sr-only')}>
                {description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-me-2 -mt-1 size-8 shrink-0 text-muted-foreground"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>

          <Separator />

          <div className="scrollbar-seamless min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 pt-4">
            <div className="space-y-4 pr-1">{children}</div>
          </div>

          <Separator />

          <AlertDialogFooter className="bg-muted/40 p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {cancelText}
            </Button>
            <Button type="submit" variant="primary" disabled={loading || disabled}>
              {loading && <IconLoader2 className="animate-spin" />}
              {loading ? 'Loading...' : confirmText}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
