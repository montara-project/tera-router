import { IconRoute } from '@tabler/icons-react'

import type { AppSettings } from '@/lib/api/models/settings'

import IconBadge from '@/components/block/common/icon-badge'
import SettingRow from '@/components/block/settings/setting-row'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface RoutingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

export default function RoutingTab({ settings, onUpdate }: RoutingTabProps) {
  const switchClass = 'data-[state=checked]:bg-amber-600'

  const distribution = settings.providerRoundRobin
    ? `Distributing requests across all available accounts with ${settings.providerStickyLimit} ${
        settings.providerStickyLimit === 1 ? 'call' : 'calls'
      } per account.`
    : 'Requests stick to the first available account in each provider group.'

  const chain = settings.chainRoundRobin
    ? 'Chains cycle through their providers round robin.'
    : 'Chains always start with their first model.'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge icon={IconRoute} variant="soft" className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>Routing Strategy</CardTitle>
            <CardDescription>
              Control how requests are distributed across accounts and chains.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          <SettingRow
            title="Provider group round robin"
            description="Cycle through accounts in the same provider/model group"
          >
            <Switch
              aria-label="Enable provider group round robin"
              checked={settings.providerRoundRobin}
              className={switchClass}
              onCheckedChange={(value) => onUpdate({ providerRoundRobin: value })}
            />
          </SettingRow>

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-52 shrink-0">
              <p className="text-sm font-medium text-foreground">Provider sticky limit</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Calls per account before switching
              </p>
            </div>
            <Input
              aria-label="Provider sticky limit"
              type="number"
              min={1}
              step={1}
              value={settings.providerStickyLimit}
              className="flex-1 text-center font-mono"
              onChange={(e) => {
                const value = e.target.valueAsNumber
                if (!Number.isNaN(value) && value >= 1) onUpdate({ providerStickyLimit: value })
              }}
            />
          </div>

          <SettingRow
            title="Chain round robin"
            description="Cycle through providers in chains instead of always starting with first"
          >
            <Switch
              aria-label="Enable chain round robin"
              checked={settings.chainRoundRobin}
              className={switchClass}
              onCheckedChange={(value) => onUpdate({ chainRoundRobin: value })}
            />
          </SettingRow>
        </div>

        <p className="text-muted-foreground border-t border-border px-5 py-4 text-xs italic">
          {distribution} {chain}
        </p>
      </CardContent>
    </Card>
  )
}
