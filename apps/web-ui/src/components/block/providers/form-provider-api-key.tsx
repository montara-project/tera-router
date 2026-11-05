import { IconChevronRight, IconCircleCheck, IconLoader2, IconX } from '@tabler/icons-react'
import { useSelector } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { ProviderAvatar } from '@/components/block/providers/provider-avatar'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AccountSchema, type AccountDto } from '@/lib/api/dtos/account/schema'
import { queries } from '@/lib/api/queries'

type ProviderIdentity = {
  slug: string
  name: string
  /** Endpoint the key will be used against, shown under the key field. */
  baseUrl?: string
  apiKind?: string
}

type AddCustomProviderApiKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Custom provider or a catalog provider identity. */
  provider: ProviderIdentity
  onSuccess?: () => void
  /** "media" is the media detail page's form: every field shown, no key test or priority. */
  variant?: 'full' | 'media'
}

/** Keyed by open state so every open starts from an empty form. */
export function AddCustomProviderApiKeyForm(props: AddCustomProviderApiKeyFormProps) {
  return <ApiKeyDialog key={`${props.provider.slug}-${props.open}`} {...props} />
}

/** base_url is a form field, not a wire field: it travels inside metadata. */
function toPayload({ base_url, ...rest }: AccountDto): AccountDto {
  const override = base_url?.trim()
  return {
    ...rest,
    api_key: rest.api_key?.trim(),
    metadata: override ? { ...rest.metadata, base_url: override } : rest.metadata,
  }
}

function ApiKeyDialog({
  open,
  onOpenChange,
  provider,
  onSuccess,
  variant = 'full',
}: AddCustomProviderApiKeyFormProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const createMutation = useMutation(queries.accounts.create())
  const testMutation = useMutation(queries.accounts.testKey())

  const form = useAppForm({
    defaultValues: {
      provider: provider.slug,
      label: '',
      auth_kind: 'api_key',
      api_key: '',
      priority: 100,
      base_url: '',
    } as AccountDto,
    validators: { onSubmit: AccountSchema },
    onSubmit: async ({ value }) => {
      if (!value.api_key?.trim()) {
        toast.error('Paste the API key first')
        return
      }
      try {
        await createMutation.mutateAsync(toPayload(value))
        toast.success(`${provider.name} account added`)
        onOpenChange(false)
        onSuccess?.()
      } catch (error) {
        // Keep the typed key so a failed save can be retried.
        toastAxiosError(error)
      }
    },
  })

  const hasKey = useSelector(form.store, (s) => Boolean(s.values.api_key?.trim()))

  const testKey = async () => {
    try {
      const res = await testMutation.mutateAsync(toPayload(form.state.values))
      const result = res.data
      if (result.ok) {
        toast.success(
          result.latency_ms
            ? `Key works · ${result.latency_ms} ms`
            : result.detail || 'Key accepted'
        )
      } else {
        toast.error(result.detail || `Key rejected (HTTP ${result.status})`)
      }
    } catch (error) {
      toastAxiosError(error)
    }
  }

  if (variant === 'media') {
    const note = 'text-xs text-muted-foreground'
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0 space-y-0.5">
                <AlertDialogTitle className="truncate text-[15px]">
                  Add {provider.name} account
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px]">
                  The key is encrypted and never shown again.
                </AlertDialogDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <IconX className="size-4" />
              </Button>
            </div>

            <div className="space-y-3.5 px-5 py-4">
              <div className="space-y-1.5">
                <form.AppField
                  name="api_key"
                  children={(field) => (
                    <field.PasswordField
                      label="API key"
                      hint="Required"
                      placeholder="sk-..."
                      className="font-mono"
                    />
                  )}
                />
                <p className={note}>Paste a key from your {provider.name} dashboard.</p>
              </div>
              <div className="space-y-1.5">
                <form.AppField
                  name="label"
                  children={(field) => (
                    <field.TextField label="Label" hint="Optional" placeholder="my-key" />
                  )}
                />
                <p className={note}>Shown in routing and usage.</p>
              </div>
              <div className="space-y-1.5">
                <form.AppField
                  name="base_url"
                  children={(field) => (
                    <field.TextField
                      label="Base URL"
                      hint="Optional"
                      placeholder="https://…"
                      className="font-mono"
                    />
                  )}
                />
                <p className={note}>Only for custom or self-hosted endpoints.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!hasKey || createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add account'}
              </Button>
            </div>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
            <ProviderAvatar
              slug={provider.slug}
              apiKind={provider.apiKind}
              size="xs"
              className="size-7"
            />
            <AlertDialogTitle className="min-w-0 flex-1 truncate text-[15px]">
              Add {provider.name} API key
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              The key is encrypted before it is stored.
            </AlertDialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <IconX className="size-4" />
            </Button>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1.5">
              <form.AppField
                name="api_key"
                children={(field) => (
                  <field.PasswordField label="API key" hint="Required" placeholder="sk-…" />
                )}
              />
              {provider.baseUrl ? (
                <p className="text-[12.5px] break-all text-muted-foreground">
                  Uses <span className="font-mono text-xs">{provider.baseUrl}</span>
                </p>
              ) : null}
            </div>

            <div className="border-t border-border pt-3">
              <button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-sm text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                <IconChevronRight
                  className={moreOpen ? 'size-3.5 rotate-90' : 'size-3.5'}
                  aria-hidden
                />
                More options
              </button>
              {moreOpen ? (
                <div className="mt-3 space-y-3">
                  <form.AppField
                    name="label"
                    children={(field) => (
                      <field.TextField label="Label" hint="Optional" placeholder="personal" />
                    )}
                  />
                  <form.AppField
                    name="priority"
                    children={(field) => (
                      <field.TextField
                        label="Priority"
                        hint="Lower runs first"
                        type="number"
                        min={1}
                        placeholder="100"
                      />
                    )}
                  />
                  <form.AppField
                    name="base_url"
                    children={(field) => (
                      <field.TextField
                        label="Base URL override"
                        hint="Optional"
                        placeholder="Leave empty to use the provider default"
                      />
                    )}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={!hasKey || testMutation.isPending}
              onClick={testKey}
            >
              {testMutation.isPending ? (
                <IconLoader2 className="animate-spin" />
              ) : (
                <IconCircleCheck />
              )}
              Test key
            </Button>
            <Button type="submit" disabled={!hasKey || createMutation.isPending}>
              {createMutation.isPending ? 'Adding…' : 'Add account'}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
