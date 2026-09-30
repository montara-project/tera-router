'use client'

import { IconCheck, IconCopy } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

interface CopySkillButtonProps {
  value: string
  label?: string
}

export default function CopySkillButton({ value, label = 'Copy skill URL' }: CopySkillButtonProps) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <Button
      type="button"
      variant="outline"
      mode="icon"
      size="icon"
      aria-label={label}
      onClick={() => copy(value)}
    >
      {copied ? <IconCheck className="text-emerald-600 dark:text-emerald-300" /> : <IconCopy />}
    </Button>
  )
}
