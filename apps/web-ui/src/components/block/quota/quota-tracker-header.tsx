import { Gauge, RefreshCw } from 'lucide-react'

import SimpleButtonGroup, {
  type SimpleButtonGroupItem,
} from '@/components/block/common/simple-button-group'
import { Button } from '@/components/ui/button'

import QuotaIconBadge from './quota-icon-badge'

const RANGE_ITEMS: SimpleButtonGroupItem[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
]

interface QuotaTrackerHeaderProps {
  range: string
  onRangeChange: (value: string) => void
  onRefresh: () => void
  refreshing?: boolean
}

export default function QuotaTrackerHeader({
  range,
  onRangeChange,
  onRefresh,
  refreshing = false,
}: QuotaTrackerHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <QuotaIconBadge
          className="h-12 w-12 rounded-xl"
          icon={Gauge}
          iconClassName="h-6 w-6"
          tone="emerald"
          variant="outline"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quota Tracker</h1>
          <p className="text-muted-foreground text-sm">
            Monitor account capacity, reported upstream limits, and period usage.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <SimpleButtonGroup defaultValue={range} items={RANGE_ITEMS} onValueChange={onRangeChange} />
        <Button
          aria-label="Refresh"
          disabled={refreshing}
          onClick={onRefresh}
          radius="full"
          size="icon"
          variant="outline"
        >
          <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
        </Button>
      </div>
    </div>
  )
}
