'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            className={variant === 'destructive' ? 'text-white' : ''}
            onClick={onConfirm}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
