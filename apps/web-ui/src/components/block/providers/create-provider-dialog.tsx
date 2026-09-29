import { IconPlus } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CustomProviderDto } from '@/lib/api/dtos/provider/schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { queries } from '@/lib/api/queries'

const AMBER_BUTTON_CLASS =
  'bg-amber-600 text-white hover:bg-amber-500/90 dark:bg-amber-600 dark:hover:bg-amber-500/90'

interface CreateProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateProviderDialog({ open, onOpenChange }: CreateProviderDialogProps) {
  const [name, setName] = useState('')
  const [dialect, setDialect] = useState('openai')
  const [baseUrl, setBaseUrl] = useState('')
  const [alias, setAlias] = useState('')

  const createMutation = useMutation(queries.providers.customCreate())

  const canSubmit = name.trim().length > 0 && baseUrl.trim().length > 0

  const reset = () => {
    setName('')
    setDialect('openai')
    setBaseUrl('')
    setAlias('')
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    const trimmedBaseUrl = baseUrl.trim()
    const trimmedAlias = alias.trim()

    if (!trimmedName || !trimmedBaseUrl || createMutation.isPending) return

    if (trimmedAlias && !/^[a-zA-Z0-9-]{1,32}$/.test(trimmedAlias)) {
      toast.error('Alias may only contain letters, digits, and hyphens (max 32)')
      return
    }

    if (!/^https?:\/\//i.test(trimmedBaseUrl)) {
      toast.error('Base URL must start with http:// or https://')
      return
    }

    try {
      const payload: CustomProviderDto = {
        name: trimmedName,
        base_url: trimmedBaseUrl,
        api_kind: dialect,
        enabled: true,
      }
      if (trimmedAlias) payload.slug = trimmedAlias

      await createMutation.mutateAsync(payload)
      toast.success('Custom provider created')
      reset()
      onOpenChange(false)
    } catch {
      toast.error('Failed to create custom provider')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-xl gap-0 p-0">
        <DialogHeader className="mb-0 shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="text-base">New custom provider</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            A dedicated instance of an OpenAI- or Anthropic-compatible endpoint. Each instance is
            isolated with its own base URL, accounts, and models.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Name (required)</p>
            <Input
              value={name}
              placeholder="e.g. Local vLLM or Acme Gateway"
              aria-label="Provider name"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Dialect</p>
            <Select value={dialect} onValueChange={setDialect}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI-compatible</SelectItem>
                <SelectItem value="anthropic">Anthropic-compatible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Base URL (required)</p>
            <Input
              value={baseUrl}
              placeholder="https://llm.example.com/v1"
              aria-label="Base URL"
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Alias / prefix (optional)</p>
            <Input
              value={alias}
              placeholder="e.g. kei-ai — models route as <alias>/<model>"
              aria-label="Alias or prefix"
              onChange={(event) => setAlias(event.target.value)}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Letters, digits, hyphens only (max 32). Leave blank to derive from the name. Models
              route as <code className="font-mono">&lt;alias&gt;</code>/
              <code className="font-mono">&lt;model&gt;</code>.
            </p>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Tip: add two separate instances for two endpoints of the same type — they will never
            share models or credentials.
          </p>
        </div>

        <DialogFooter className="mb-0 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={AMBER_BUTTON_CLASS}
            disabled={!canSubmit || createMutation.isPending}
            onClick={handleCreate}
          >
            <IconPlus />
            <span>{createMutation.isPending ? 'Creating…' : 'Create provider'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
