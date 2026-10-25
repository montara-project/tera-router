import { IconCheck, IconCopy, IconDownload } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { RelayKind, RelayScript } from '@/lib/api/models/proxy-pool'

import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { saveFile } from '@/lib/file'

const RELAY_COPY: Record<RelayKind, { title: string; steps: string[]; host: string }> = {
  cloudflare: {
    title: 'Deploy a Cloudflare Worker relay',
    steps: [
      'Download worker.js below.',
      'Deploy it: npx wrangler deploy worker.js --name tera-relay --compatibility-date 2024-09-23 (or paste it into a new Worker in the Cloudflare dashboard).',
      'Enter the Worker host, e.g. tera-relay.your-subdomain, and register the pool.',
    ],
    host: 'tera-relay.your-subdomain',
  },
  local: {
    title: 'Run a local relay process',
    steps: [
      'Download relay.mjs below.',
      'Run it on the exit machine with Node 18+: node relay.mjs (PORT defaults to 8790).',
      'Enter the host Tera Router reaches it on, e.g. 10.0.0.5, and register the pool.',
    ],
    host: '10.0.0.5',
  },
}

type RelayDialogProps = {
  /** The relay kind being deployed; null keeps the dialog closed. */
  kind: RelayKind | null
  /** The generated script; undefined while it is being generated. */
  relay?: RelayScript
  onClose: () => void
}

export default function RelayDialog({ kind, relay, onClose }: RelayDialogProps) {
  const [host, setHost] = useState('')
  const createMutation = useMutation(queries.proxyPools.create())
  const { copied, copy } = useCopyToClipboard()

  if (!kind) return null
  const copyText = RELAY_COPY[kind]
  const poolUrl = relay && host.trim() ? relay.pool_url.replace('RELAY_HOST', host.trim()) : ''

  const handleRegister = () => {
    createMutation.mutate(
      { name: `${kind}-relay`, url: poolUrl, label: kind === 'cloudflare' ? 'cloudflare relay' : 'local relay' },
      {
        onSuccess: () => {
          toast.success('Relay registered — run a health check once it is deployed')
          onClose()
        },
        onError: toastAxiosError,
      }
    )
  }

  return (
    <SimpleDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copyText.title}
      description="The relay replays upstream calls for Tera Router. It only answers requests that carry the secret baked into this script."
      size="lg"
    >
      <div className="space-y-4">
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-xs">
          {copyText.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">{relay?.filename ?? 'generating…'}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!relay}
                onClick={() => relay && copy(relay.script)}
              >
                {copied ? <IconCheck /> : <IconCopy />}
                <span>Copy</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!relay}
                onClick={() =>
                  relay && saveFile(new Blob([relay.script], { type: 'text/javascript' }), relay.filename)
                }
              >
                <IconDownload />
                <span>Download</span>
              </Button>
            </div>
          </div>
          <pre className="bg-muted/40 max-h-56 overflow-auto rounded-lg border border-border p-3 font-mono text-[11px] leading-relaxed">
            {relay?.script ?? ''}
          </pre>
        </div>

        <div className="space-y-2">
          <label htmlFor="relay-host" className="text-xs font-medium">
            Relay host
          </label>
          <Input
            id="relay-host"
            placeholder={copyText.host}
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
          {poolUrl && <code className="text-muted-foreground block truncate font-mono text-xs">{poolUrl}</code>}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!poolUrl || createMutation.isPending} onClick={handleRegister}>
            Register pool
          </Button>
        </div>
      </div>
    </SimpleDialog>
  )
}
