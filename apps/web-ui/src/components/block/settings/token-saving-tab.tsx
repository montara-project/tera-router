import {
  IconArrowsMinimize,
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconMessageDown,
  IconServer,
} from '@tabler/icons-react'

import type { AppSettings, SourceCodeFilterMode } from '@/lib/api/models/settings'

import SettingRow, {
  SegmentedControl,
  SettingsSection,
  UnitInput,
} from '@/components/block/settings/setting-row'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

interface TokenSavingTabProps {
  settings: AppSettings
  onUpdate: (patch: Partial<AppSettings>) => void
}

const SOURCE_CODE_FILTER_OPTIONS: { value: SourceCodeFilterMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'aggressive', label: 'Aggressive' },
]

const SOURCE_CODE_FILTER_DESCRIPTIONS: Record<SourceCodeFilterMode, string> = {
  off: 'No source code comment stripping.',
  minimal: 'Strips whole-line // comments from tool outputs.',
  aggressive: 'Strips whole-line //, # and /* */ comments from tool outputs.',
}

/** The install steps, with each line's trailing comment kept apart for styling. */
const INSTALL_LINES: { command: string; comment?: string }[] = [
  {
    command: 'pipx install "headroom-ai[all]"',
    comment: '# needs Python 3.10+ (or: pip install --user)',
  },
  { command: 'pipx ensurepath', comment: '# add headroom to PATH, then restart your shell' },
  { command: 'headroom proxy --port 8787' },
  { command: 'headroom doctor', comment: "# verify it's working" },
]

export default function TokenSavingTab({ settings, onUpdate }: TokenSavingTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <SettingsSection
        icon={IconArrowsMinimize}
        title="Input compression"
        description="Saves input tokens"
      >
        <SettingRow
          title="RTK input compression"
          description="Shrinks bulky tool output before it reaches the model."
          info="Compresses diffs, greps, listings and build logs in tool results. Safe by design: it never corrupts content."
        >
          <Switch
            aria-label="RTK input compression"
            checked={settings.rtk_enabled}
            onCheckedChange={(value) => onUpdate({ rtk_enabled: value })}
          />
        </SettingRow>
        <SettingRow
          nested
          title="Source code filter"
          description={SOURCE_CODE_FILTER_DESCRIPTIONS[settings.source_code_filter]}
        >
          <SegmentedControl
            aria-label="Source code filter"
            options={SOURCE_CODE_FILTER_OPTIONS}
            value={settings.source_code_filter}
            onChange={(value) => onUpdate({ source_code_filter: value as SourceCodeFilterMode })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        icon={IconMessageDown}
        title="Output compression"
        description="Caveman and terse can't run together"
      >
        <SettingRow
          title="Caveman mode"
          description="Terse caveman-style answers. Cuts output tokens 65–75%."
          info="Instructs the model to answer tersely, keeping all technical substance and dropping filler."
        >
          <Switch
            aria-label="Caveman mode"
            checked={settings.caveman_enabled}
            // Both inject a system instruction, so turning one on turns the other off.
            onCheckedChange={(value) =>
              onUpdate(
                value ? { caveman_enabled: true, terse_enabled: false } : { caveman_enabled: false }
              )
            }
          />
        </SettingRow>
        <SettingRow
          title="Terse mode"
          description="Tera Router's own concise-output instruction."
          info="An alternative to caveman mode with a lighter touch."
        >
          <Switch
            aria-label="Terse mode"
            checked={settings.terse_enabled}
            onCheckedChange={(value) =>
              onUpdate(
                value ? { terse_enabled: true, caveman_enabled: false } : { terse_enabled: false }
              )
            }
          />
        </SettingRow>
        <SettingRow
          title="Ponytail"
          description="Biases the model toward minimal code changes."
          info="Adds a lazy-senior-developer instruction. Works on top of caveman or terse mode."
        >
          <Switch
            aria-label="Ponytail"
            checked={settings.ponytail_enabled}
            onCheckedChange={(value) => onUpdate({ ponytail_enabled: value })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        icon={IconServer}
        title="Headroom proxy"
        description="External input compression"
      >
        <SettingRow
          title="Headroom input compression"
          description="Fails open — proxy errors leave the request untouched."
        >
          <Switch
            aria-label="Headroom input compression"
            checked={settings.headroom_enabled}
            onCheckedChange={(value) => onUpdate({ headroom_enabled: value })}
          />
        </SettingRow>
        {settings.headroom_enabled ? (
          <>
            <SettingRow nested title="Proxy URL" description="Base URL of the Headroom proxy.">
              <Input
                key={settings.headroom_url}
                aria-label="Headroom proxy URL"
                type="url"
                defaultValue={settings.headroom_url}
                placeholder="http://localhost:8787"
                className="w-64 font-mono"
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (value && value !== settings.headroom_url) onUpdate({ headroom_url: value })
                }}
              />
            </SettingRow>
            <SettingRow nested title="Timeout" description="Fails open past this. Default 5 s.">
              <UnitInput
                label="Headroom timeout in seconds"
                unit="sec"
                min={1}
                value={settings.headroom_timeout}
                onCommit={(value) => onUpdate({ headroom_timeout: value })}
              />
            </SettingRow>
          </>
        ) : null}
        <HeadroomGuide />
      </SettingsSection>
    </div>
  )
}

function HeadroomGuide() {
  const { copied, copy } = useCopyToClipboard()
  const script = INSTALL_LINES.map((l) => l.command).join('\n')

  return (
    <details className="group px-4 py-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-[12.5px] font-medium text-blue-600 dark:text-blue-400 [&::-webkit-details-marker]:hidden">
        <IconChevronRight
          className="size-3.5 transition-transform group-open:rotate-90"
          aria-hidden
        />
        How Headroom works and how to install it
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Best with a fast, local proxy.</span>{' '}
          Headroom runs before each request. Large or first-seen contexts can take several seconds
          to compress (longer on CPU-only machines); past the timeout the request goes through
          uncompressed and records no savings.
        </p>
        <div className="flex flex-col gap-2">
          <p>
            Install the{' '}
            <code className="rounded-sm bg-muted px-1 font-mono text-[11.5px] text-foreground">
              headroom
            </code>{' '}
            CLI from the Python package (the npm package is a library only), then start it:
          </p>
          <div className="relative rounded-md border border-border bg-background">
            <pre className="overflow-x-auto py-3 pr-12 pl-3.5 font-mono text-[12.5px] leading-relaxed">
              {INSTALL_LINES.map((line) => (
                <div key={line.command}>
                  <span className="text-foreground">{line.command}</span>
                  {line.comment ? (
                    <span className="text-muted-foreground"> {line.comment}</span>
                  ) : null}
                </div>
              ))}
            </pre>
            <button
              type="button"
              aria-label={copied ? 'Copied' : 'Copy install commands'}
              onClick={() => copy(script)}
              className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            Then set <span className="font-medium text-foreground">Proxy URL</span> to{' '}
            <code className="rounded-sm bg-muted px-1 font-mono text-[11.5px] text-foreground">
              http://localhost:8787
            </code>
            .
          </p>
          <a
            href="https://github.com/headroomlabs-ai/headroom"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Headroom installation guide
            <IconExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </details>
  )
}
