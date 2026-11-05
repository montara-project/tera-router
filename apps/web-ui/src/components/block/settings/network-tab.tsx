import { IconClock, IconGauge, IconWorld } from '@tabler/icons-react'

import type { AppSettings } from '@/lib/api/models/settings'

import SettingRow, { SettingsSection, UnitInput } from '@/components/block/settings/setting-row'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface NetworkTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

const TIMEOUTS: {
  key: 'connect_timeout' | 'stream_stall_timeout' | 'request_timeout'
  title: string
  description: string
}[] = [
  {
    key: 'connect_timeout',
    title: 'First response timeout',
    description: 'How long a provider may take to start responding. Default 60 s.',
  },
  {
    key: 'stream_stall_timeout',
    title: 'Stream stall timeout',
    description: 'Abort a stream that sends nothing for this long. Default 300 s.',
  },
  {
    key: 'request_timeout',
    title: 'Request timeout',
    description: 'Upper limit for a non-streaming request, fallbacks included. Default 300 s.',
  },
]

export default function NetworkTab({ settings, onUpdate }: NetworkTabProps) {
  const proxyOn = settings.outbound_proxy_enabled

  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        icon={IconClock}
        title="Timeouts"
        description="Raise these for slow or reasoning models"
      >
        {TIMEOUTS.map((t) => (
          <SettingRow key={t.key} title={t.title} description={t.description}>
            <UnitInput
              label={t.title}
              unit="sec"
              min={1}
              value={settings[t.key]}
              onCommit={(value) => onUpdate({ [t.key]: value })}
            />
          </SettingRow>
        ))}
      </SettingsSection>

      <SettingsSection
        icon={IconWorld}
        title="Outbound proxy"
        description="HTTP, HTTPS or SOCKS5 proxy for provider requests"
        aside={
          <span
            className={cn(
              'inline-flex h-6 items-center rounded-md px-2.5 text-[11.5px] font-medium',
              proxyOn
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {proxyOn ? 'Enabled' : 'Disabled'}
          </span>
        }
      >
        <SettingRow
          title="Use outbound proxy"
          description="Applies to provider requests and OAuth sign-ins for accounts without their own proxy pool."
        >
          <Switch
            aria-label="Use outbound proxy"
            checked={proxyOn}
            onCheckedChange={(value) => onUpdate({ outbound_proxy_enabled: value })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection icon={IconGauge} title="Limits and logging">
        <SettingRow
          title="Enforce API key rate limits"
          description="Apply each key's plan RPM, TPM and concurrency limits."
        >
          <Switch
            aria-label="Enforce API key rate limits"
            checked={settings.enforce_rate_limits}
            onCheckedChange={(value) => onUpdate({ enforce_rate_limits: value })}
          />
        </SettingRow>
        <SettingRow
          title="Record request details"
          description="Store request details for the logs view."
        >
          <Switch
            aria-label="Record request details"
            checked={settings.request_detail_recording}
            onCheckedChange={(value) => onUpdate({ request_detail_recording: value })}
          />
        </SettingRow>
      </SettingsSection>
    </div>
  )
}
