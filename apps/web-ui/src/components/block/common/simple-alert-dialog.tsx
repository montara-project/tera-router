'use client'

import { IconAlertTriangle } from '@tabler/icons-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SimpleAlertDialogProps {
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel?: () => void
  onConfirm?: () => void
  cancelText?: string
  confirmText?: string
  variant?: 'primary' | 'destructive'
}

/** Confirmation dialog. The destructive variant leads with a warning icon. */
export default function SimpleAlertDialog({
  title,
  description,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  cancelText = 'Cancel',
  confirmText = 'Proceed',
  variant = 'destructive',
}: SimpleAlertDialogProps) {
  const destructive = variant === 'destructive'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md gap-5 p-5">
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <IconAlertTriangle className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0 space-y-1.5 pt-1">
            <AlertDialogTitle className="text-[15px]">{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-[13px]">{description}</AlertDialogDescription>
            )}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            className={destructive ? 'text-white' : ''}
            onClick={onConfirm}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
