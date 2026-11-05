import { IconRoute } from '@tabler/icons-react'

import type { AppSettings } from '@/lib/api/models/settings'

import SettingRow, {
  SegmentedControl,
  SettingsSection,
  UnitInput,
} from '@/components/block/settings/setting-row'
import { Switch } from '@/components/ui/switch'

interface RoutingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

const ACCOUNT_STRATEGIES = [
  { value: 'fill-first', label: 'Fill first' },
  { value: 'round-robin', label: 'Round robin' },
]

export default function RoutingTab({ settings, onUpdate }: RoutingTabProps) {
  const roundRobin = settings.provider_round_robin

  return (
    <SettingsSection
      icon={IconRoute}
      title="Routing strategy"
      description="Providers can override this on their Routing tab"
    >
      <SettingRow
        stacked
        title="Accounts in a provider group"
        description={
          roundRobin
            ? 'Rotate requests across accounts, a few calls per account at a time.'
            : 'Use the first available account until it fails or runs out, then the next.'
        }
      >
        <SegmentedControl
          aria-label="Accounts in a provider group"
          options={ACCOUNT_STRATEGIES}
          value={roundRobin ? 'round-robin' : 'fill-first'}
          onChange={(value) => onUpdate({ provider_round_robin: value === 'round-robin' })}
        />
      </SettingRow>
      {roundRobin ? (
        <SettingRow
          nested
          title="Provider sticky limit"
          description="Calls per account before moving to the next one. 1–100."
        >
          <UnitInput
            label="Provider sticky limit"
            unit="calls"
            min={1}
            max={100}
            value={settings.provider_sticky_limit}
            onCommit={(value) => onUpdate({ provider_sticky_limit: value })}
          />
        </SettingRow>
      ) : null}
      <SettingRow
        title="Chain round robin"
        description="Rotate the models of priority chains instead of always starting with the first."
      >
        <Switch
          aria-label="Chain round robin"
          checked={settings.chain_round_robin}
          onCheckedChange={(value) => onUpdate({ chain_round_robin: value })}
        />
      </SettingRow>
    </SettingsSection>
  )
}
