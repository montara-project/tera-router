import {
  IconBolt,
  IconExternalLink,
  IconInfoCircle,
  IconStack2,
  IconMessage,
  IconTerminal2,
} from '@tabler/icons-react'

import type { AppSettings, SourceCodeFilterMode } from '@/lib/api/models/settings'

import IconBadge from '@/components/block/common/icon-badge'
import SettingRow, { SegmentedControl } from '@/components/block/settings/setting-row'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

interface TokenSavingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

const SOURCE_CODE_FILTER_OPTIONS: { value: SourceCodeFilterMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'aggressive', label: 'Aggressive' },
]

const CODE_LINES: { command: string; comment?: string }[] = [
  {
    command: 'pipx install "headroom-ai[all]"',
    comment: '# needs Python 3.10+ (or: pip install --user)',
  },
  { command: 'pipx ensurepath', comment: '# add headroom to PATH, then restart your shell' },
  { command: 'headroom proxy --port 8787', comment: "# verify it's working" },
  { command: 'headroom doctor' },
]

const ariaLabels = {
  rtkEnabled: 'Enable RTK token saver',
  cavemanEnabled: 'Enable caveman mode',
  terseEnabled: 'Enable terse mode',
  headroomEnabled: 'Enable Headroom',
  ponytailEnabled: 'Enable Ponytail',
}

export default function TokenSavingTab({ settings, onUpdate }: TokenSavingTabProps) {
  const switchClass = 'data-[state=checked]:bg-amber-600'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconBolt}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>RTK input compression</CardTitle>
              <CardDescription>
                Compresses bulky tool outputs (diffs, greps, listings, build logs) before they reach
                the model. Saves input tokens. Safe by design — never corrupts content.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow title="Enable RTK token saver">
              <Switch
                aria-label={ariaLabels.rtkEnabled}
                checked={settings.rtkEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ rtkEnabled: value })}
              />
            </SettingRow>
            <SettingRow title="Source code filter" description="No source code comment stripping.">
              <SegmentedControl
                onChange={(value) => onUpdate({ sourceCodeFilter: value as SourceCodeFilterMode })}
                options={SOURCE_CODE_FILTER_OPTIONS}
                value={settings.sourceCodeFilter}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconMessage}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Caveman output compression</CardTitle>
              <CardDescription>
                Instructs the model to answer tersely (caveman style) — keeps all technical
                substance, drops filler. Cuts output tokens 65-75%.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow title="Enable caveman mode">
              <Switch
                aria-label={ariaLabels.cavemanEnabled}
                checked={settings.cavemanEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ cavemanEnabled: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconStack2}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Terse mode (alternative)</CardTitle>
              <CardDescription>
                KeiRouter's own concise-output directive. An alternative to caveman; both inject a
                system instruction, so pick one.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow title="Enable terse mode">
              <Switch
                aria-label={ariaLabels.terseEnabled}
                checked={settings.terseEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ terseEnabled: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconBolt}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Headroom input compression</CardTitle>
              <CardDescription>
                Compresses request messages through an external Headroom proxy before they reach the
                model. Fail-open — any proxy error leaves the request untouched.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-5 py-5">
            <div className="flex gap-3 rounded-lg bg-muted/50 p-4">
              <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong className="font-semibold text-foreground">
                  Best for a fast, local proxy
                </strong>
                : Headroom is called synchronously before each request. Large or first-seen contexts
                can take the proxy several seconds (sometimes much longer on CPU-only machines) to
                compress — when that exceeds the timeout below, Headroom{' '}
                <strong className="font-semibold text-foreground">fails open</strong> (the request
                goes through uncompressed and records 0 savings). For consistent savings without an
                external dependency, rely on{' '}
                <strong className="font-semibold text-foreground">
                  RTK + Caveman/Terse + Ponytail
                </strong>
                , which run instantly in-process.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border border-t border-border">
            <SettingRow title="Enable Headroom">
              <Switch
                aria-label={ariaLabels.headroomEnabled}
                checked={settings.headroomEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ headroomEnabled: value })}
              />
            </SettingRow>
          </div>

          <div className="border-t border-border p-5">
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <IconTerminal2 className="h-4 w-4 text-muted-foreground" />
                Don't have a Headroom proxy yet?
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Headroom is a local, open-source compression proxy. The{' '}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                  headroom
                </code>{' '}
                CLI ships with the Python package (the npm package is a library only). Install it
                with pipx, then start it:
              </p>
              <div className="space-y-1.5 rounded-md bg-background p-3 font-mono text-xs">
                {CODE_LINES.map((line) => (
                  <div key={line.command} className="flex flex-wrap gap-x-6">
                    <code className="text-foreground">{line.command}</code>
                    {line.comment && <span className="text-muted-foreground">{line.comment}</span>}
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Then set <strong className="font-semibold text-foreground">Proxy URL</strong> to{' '}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                  http://localhost:8787
                </code>
                .
              </p>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 dark:text-amber-400 dark:hover:text-amber-300"
                type="button"
              >
                Installation guide
                <IconExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3.5">
            <IconBadge
              icon={IconMessage}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Ponytail output compression</CardTitle>
              <CardDescription>
                Injects a lazy-senior-developer system prompt that biases the model toward minimal
                code. Layers on top of Terse or Caveman.
              </CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <SettingRow title="Enable Ponytail">
              <Switch
                aria-label={ariaLabels.ponytailEnabled}
                checked={settings.ponytailEnabled}
                className={switchClass}
                onCheckedChange={(value) => onUpdate({ ponytailEnabled: value })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
