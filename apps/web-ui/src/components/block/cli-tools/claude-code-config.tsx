import {
  IconCheck,
  IconCopy,
  IconCpu,
  IconKey,
  IconLoader2,
  IconPlayerPlay,
  IconSettings,
  IconTerminal2,
  IconWorld,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ClaudeCodeStatus } from '@/lib/api/models/cli-tool'
import type { ApiKey } from '@/lib/api/models/key'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { env } from '@/config/env'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

interface ClaudeCodeConfigProps {
  status: ClaudeCodeStatus
  apiKeys: ApiKey[]
}

/** Renders the settings.json document Claude Code reads; the server's apply
 * endpoint writes the same shape. */
function settingsJson(baseUrl: string, token: string, model: string) {
  const envBlock: Record<string, string> = {
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: token,
  }
  if (model) envBlock.ANTHROPIC_MODEL = model
  return JSON.stringify({ hasCompletedOnboarding: true, env: envBlock }, null, 2)
}

const FIELD_ICON_CLASS = 'text-muted-foreground size-4 shrink-0'

export default function ClaudeCodeConfig({ status, apiKeys }: ClaudeCodeConfigProps) {
  const activeKeys = apiKeys.filter((key) => key.status === 'active')
  const [baseUrl, setBaseUrl] = useState(status.base_url || env.VITE_API_URL)
  const [keyId, setKeyId] = useState(
    activeKeys.find((key) => key.id === status.current_key_id)?.id ?? activeKeys[0]?.id ?? ''
  )
  const [model, setModel] = useState(status.model)
  const [showSnippet, setShowSnippet] = useState(true)
  const [revealed, setRevealed] = useState<{ id: string; value: string } | null>(null)
  const { copied, copy } = useCopyToClipboard()

  const applyMutation = useMutation(queries.cliTools.applyClaudeCode())
  const revealMutation = useMutation(queries.keys.reveal())

  const selectedKey = apiKeys.find((key) => key.id === keyId)
  const normalizedUrl = baseUrl.trim().replace(/\/+$/, '')
  const trimmedModel = model.trim()

  const handleApply = async () => {
    try {
      const res = await applyMutation.mutateAsync({
        base_url: normalizedUrl,
        key_id: keyId,
        model: trimmedModel,
      })
      toast.success(res.message ?? 'Claude Code configured')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  // The list payload carries only the masked preview, so copying a usable
  // snippet goes through the audit-logged reveal endpoint once per key.
  const handleCopy = async () => {
    if (!selectedKey) return
    let token = revealed?.id === selectedKey.id ? revealed.value : null
    if (!token) {
      try {
        const res = await revealMutation.mutateAsync(selectedKey.id)
        token = res.data.full_key
        setRevealed({ id: selectedKey.id, value: token })
      } catch (error) {
        toastAxiosError(error)
        return
      }
    }
    copy(settingsJson(normalizedUrl, token, trimmedModel))
  }

  return (
    <>
      <Card className="bg-background">
        <CardHeader className="h-20 border-b-0">
          <div className="flex items-center gap-3.5">
            <IconBadge icon={IconSettings} className="h-10 w-10" iconClassName="h-5 w-5" />
            <CardHeading>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Set the endpoint, API key, and model for this tool.</CardDescription>
            </CardHeading>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-1">
          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium" htmlFor="claude-base-url">
              Endpoint URL
            </label>
            <div className="flex items-center gap-3">
              <IconWorld aria-hidden className={FIELD_ICON_CLASS} />
              <Input
                id="claude-base-url"
                variant="lg"
                className="font-mono"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <p className="text-muted-foreground text-[11px]">
              Current: <span className="font-mono">{status.base_url || 'not configured'}</span>
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium" htmlFor="claude-api-key">
              API Key
            </label>
            <div className="flex items-center gap-3">
              <IconKey aria-hidden className={FIELD_ICON_CLASS} />
              <Select
                value={keyId}
                onValueChange={setKeyId}
                disabled={activeKeys.length === 0}
                indicatorPosition="right"
              >
                <SelectTrigger id="claude-api-key" size="lg">
                  <SelectValue placeholder="No active API keys" />
                </SelectTrigger>
                <SelectContent>
                  {activeKeys.map((key) => (
                    <SelectItem key={key.id} value={key.id}>
                      {key.name}
                      {key.id === status.current_key_id && (
                        <span className="text-muted-foreground"> (current)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeKeys.length === 0 && (
              <p className="text-muted-foreground text-[11px]">
                <Link to="/keys" className="text-foreground underline underline-offset-2">
                  Create an API key
                </Link>{' '}
                to wire Claude Code to this router.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-muted-foreground text-xs font-medium" htmlFor="claude-model">
              Default model (optional)
            </label>
            <div className="flex items-center gap-3">
              <IconCpu aria-hidden className={FIELD_ICON_CLASS} />
              <Input
                id="claude-model"
                variant="lg"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder="provider/model-id or chain:my-chain"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="lg"
              className="bg-amber-600 text-white hover:bg-amber-500"
              disabled={!keyId || !normalizedUrl || applyMutation.isPending}
              onClick={handleApply}
            >
              {applyMutation.isPending ? (
                <IconLoader2 className="animate-spin" />
              ) : (
                <IconPlayerPlay />
              )}
              Apply
            </Button>
            <Button
              size="lg"
              variant="outline"
              aria-expanded={showSnippet}
              aria-controls="claude-config-snippet"
              onClick={() => setShowSnippet((v) => !v)}
            >
              <IconTerminal2 />
              {showSnippet ? 'Hide snippet' : 'Show snippet'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showSnippet && (
        <Card
          id="claude-config-snippet"
          className="bg-background animate-in fade-in-0 duration-200"
        >
          <CardHeader className="h-20 border-b-0">
            <div className="flex items-center gap-3.5">
              <span className="bg-muted text-foreground ring-border flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1">
                <IconTerminal2 className="h-5 w-5" />
              </span>
              <CardHeading>
                <CardTitle>Config snippet</CardTitle>
                <CardDescription>
                  Paste into ~/.claude/settings.json — Claude Code reads env vars from here.
                </CardDescription>
              </CardHeading>
            </div>
            <CardToolbar>
              <Button
                size="lg"
                variant="outline"
                disabled={!selectedKey || revealMutation.isPending}
                onClick={handleCopy}
              >
                <span className="grid *:col-start-1 *:row-start-1">
                  <IconCopy
                    className={cn('transition-all duration-200', copied && 'scale-50 opacity-0')}
                  />
                  <IconCheck
                    className={cn(
                      'text-emerald-500 transition-all duration-200',
                      !copied && 'scale-50 opacity-0'
                    )}
                  />
                </span>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </CardToolbar>
          </CardHeader>
          <CardContent className="space-y-2 pt-1">
            <pre className="bg-muted/50 overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
              <span className="text-muted-foreground"># ~/.claude/settings.json</span>
              {'\n'}
              {settingsJson(
                normalizedUrl,
                selectedKey?.key_preview ?? '<your-api-key>',
                trimmedModel
              )}
            </pre>
            <p className="text-muted-foreground text-[11px]">
              The key is masked here; Copy inserts the full key.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
