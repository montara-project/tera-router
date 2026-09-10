'use client'

import { IconCheck, IconCopy, type IconKey } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

export type ChainToneVariant = 'accent' | 'success' | 'info' | 'warning'

interface ChainGroupProps {
  icon: typeof IconKey | React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: string
  tone: ChainToneVariant
}

export default function ChainGroup({ icon: Icon, title, description, tone }: ChainGroupProps) {
  const { copied, copy } = useCopyToClipboard()

  const tones: Record<ChainToneVariant, { icon: string; background: string }> = {
    accent: {
      icon: 'text-rose-600 dark:text-rose-300',
      background: 'bg-rose-50 ring-rose-200/70 dark:bg-rose-950/30 dark:ring-rose-900/60',
    },
    success: {
      icon: 'text-emerald-600 dark:text-emerald-300',
      background:
        'bg-emerald-50 ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-900/60',
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-300',
      background: 'bg-blue-50 ring-blue-200/70 dark:bg-blue-950/30 dark:ring-blue-900/60',
    },
    warning: {
      icon: 'text-amber-700 dark:text-amber-300',
      background: 'bg-amber-50 ring-amber-200/70 dark:bg-amber-950/30 dark:ring-amber-900/60',
    },
  }

  const colors = tones[tone]

  return (
    <div className="flex items-center gap-4">
      <Button
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.background}`}
      >
        <Icon className={`size-5.5 ${colors.icon}`} />
      </Button>
      <div className="flex flex-col justify-center">
        <span className="text-sm text-neutral-100">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{description}</span>
          <Button
            type="button"
            variant="ghost"
            mode="icon"
            size="sm"
            className="size-5.5"
            aria-label="Copy to clipboard"
            onClick={() => copy(description)}
          >
            {copied ? (
              <IconCheck className="size-3.5 text-green-600" />
            ) : (
              <IconCopy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
