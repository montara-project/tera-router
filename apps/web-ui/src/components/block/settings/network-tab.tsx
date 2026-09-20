import { IconClock, IconDeviceDesktop, IconShield, IconWifi } from '@tabler/icons-react'

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

interface NetworkTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

const TIMEOUT_FIELDS: {
  key: 'connectTimeout' | 'streamStallTimeout' | 'requestTimeout'
  label: string
  default: string
}[] = [
  { key: 'connectTimeout', label: 'Connect timeout (sec)', default: '60s' },
  { key: 'streamStallTimeout', label: 'Stream stall timeout (sec)', default: '120s' },
  { key: 'requestTimeout', label: 'Request timeout (sec)', default: '300s (5 min)' },
]

const ariaLabels = {
  enforceRateLimits: 'Enforce API key rate limits',
  outboundProxy: 'Enable outbound proxy',
  requestDetailRecording: 'Enable request detail recording',
}

export default function NetworkTab({ settings, onUpdate }: NetworkTabProps) {
  const switchClass = 'data-[state=checked]:bg-amber-600'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconClock}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Timeouts</CardTitle>
              <CardDescription>
                Fine-tune upstream connection and streaming timeouts. Increase for slow providers or
                reasoning models.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TIMEOUT_FIELDS.map((field) => (
              <div key={field.key} className="min-w-0 space-y-2">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor={`network-${field.key}`}
                >
                  {field.label}
                </label>
                <Input
                  id={`network-${field.key}`}
                  aria-label={field.label}
                  type="number"
                  min={1}
                  step={1}
                  value={settings[field.key]}
                  className="text-center font-mono"
                  onChange={(e) => {
                    const value = e.target.valueAsNumber
                    if (!Number.isNaN(value) && value >= 1) onUpdate({ [field.key]: value })
                  }}
                />
                <p className="text-muted-foreground text-xs">Default: {field.default}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconShield}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Rate Limits</CardTitle>
              <CardDescription>
                Enable per-key RPM, TPM, and concurrency limits from assigned plans.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow
              title="Enforce API key rate limits"
              description="When enabled, plan limits are enforced immediately. Blank or 0 plan values remain unlimited."
            >
              <Switch
                aria-label={ariaLabels.enforceRateLimits}
                checked={settings.enforceRateLimits}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ enforceRateLimits: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconWifi}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Network Proxy</CardTitle>
              <CardDescription>
                Route all provider outbound requests through an HTTP/HTTPS/SOCKS5 proxy.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow
              title="Outbound Proxy"
              badge={
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {settings.outboundProxyEnabled ? 'Active' : 'Inactive'}
                </span>
              }
              description="Applies to all provider and OAuth requests when no per-account proxy is set."
            >
              <Switch
                aria-label={ariaLabels.outboundProxy}
                checked={settings.outboundProxyEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ outboundProxyEnabled: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconDeviceDesktop}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Observability</CardTitle>
              <CardDescription>Record request details for inspection in the logs view.</CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow title="Enable request detail recording">
              <Switch
                aria-label={ariaLabels.requestDetailRecording}
                checked={settings.requestDetailRecording}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ requestDetailRecording: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
