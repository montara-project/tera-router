import type { IconKey } from '@tabler/icons-react'

export type ConnectToneVariant = 'accent' | 'success' | 'info' | 'warning'

interface ConnectAppProps {
  icon: typeof IconKey | React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  description: React.ReactNode
  tone: ConnectToneVariant
}

export default function ConnectApp({ icon: Icon, title, description, tone }: ConnectAppProps) {
  const tones: Record<ConnectToneVariant, { icon: string; background: string }> = {
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
    <div className="flex min-w-0 flex-1 basis-52 items-center gap-4">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.background}`}
      >
        <Icon className={`size-6 ${colors.icon}`} />
      </span>
      <div className="flex min-w-0 flex-col justify-center gap-1">
        <span className="text-sm text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </div>
  )
}
