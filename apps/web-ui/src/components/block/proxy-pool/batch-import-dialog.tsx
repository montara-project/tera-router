import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ProxyPoolDto } from '@/lib/api/dtos/proxy-pool/schema'

import SimpleDialog from '@/components/block/common/simple-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/**
 * One pool per line: `url`, `name | url` or `name | url | label`. Blank lines
 * and `#` comments are skipped; a bare URL is named after its host.
 */
export function parsePoolLines(text: string): ProxyPoolDto[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim())
      const [name, url, label] = parts.length === 1 ? ['', parts[0], ''] : parts
      return { name: name || hostOf(url), url, label: label || undefined }
    })
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

type BatchImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BatchImportDialog({ open, onOpenChange }: BatchImportDialogProps) {
  const [text, setText] = useState('')
  const mutation = useMutation(queries.proxyPools.bulkCreate())
  const pools = parsePoolLines(text)

  const handleImport = () => {
    mutation.mutate(pools, {
      onSuccess: (res) => {
        toast.success(res.message ?? `Imported ${pools.length} proxy pools`)
        setText('')
        onOpenChange(false)
      },
      onError: toastAxiosError,
    })
  }

  return (
    <SimpleDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Batch import proxy pools"
      description="One pool per line: url, name | url, or name | url | label. The batch is saved all at once or not at all."
      size="lg"
    >
      <div className="space-y-4">
        <Textarea
          aria-label="Proxy pools, one per line"
          className="min-h-48 font-mono text-xs"
          placeholder={'http://user:pass@10.0.0.2:3128\neu-exit | socks5://10.0.0.3:1080 | eu'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">
            {pools.length} {pools.length === 1 ? 'pool' : 'pools'} detected
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pools.length === 0 || mutation.isPending}
              onClick={handleImport}
            >
              Import {pools.length > 0 ? pools.length : ''}
            </Button>
          </div>
        </div>
      </div>
    </SimpleDialog>
  )
}
