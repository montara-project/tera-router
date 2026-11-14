import { IconKey, IconShieldCheck, IconTemplate } from '@tabler/icons-react'

import { Stat } from '@/components/block/provider-detail/provider-stat-strip'
import { cn } from '@/lib/utils'

const TILE = 'bg-orange-500/10 text-orange-600 dark:text-orange-400'

/** Summary strip; the server counts these over every plan. */
export default function PlansStats({
  total,
  keysAssigned,
  hardCutoff,
  unused,
}: {
  total: number
  keysAssigned: number
  hardCutoff: number
  unused: number
}) {
  const figure = (value: number, muted = false) => (
    <span className={cn('text-xl font-semibold tabular-nums', muted && 'text-muted-foreground')}>
      {value}
    </span>
  )
  const note = (text: string) => <span className="block text-xs text-muted-foreground">{text}</span>

  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      <Stat icon={IconKey} label="Keys assigned" iconClassName={TILE}>
        {figure(keysAssigned)}
      </Stat>
      <Stat icon={IconShieldCheck} label="Hard cutoff" iconClassName={TILE}>
        {figure(hardCutoff)}
        {note(`of ${total} ${total === 1 ? 'plan' : 'plans'}`)}
      </Stat>
      <Stat icon={IconTemplate} label="Unused plans" iconClassName={TILE}>
        {figure(unused, unused === 0)}
        {note(`of ${total}`)}
      </Stat>
    </dl>
  )
}
