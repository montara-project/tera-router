import { IconLock, IconPower } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Switch } from '@/components/ui/switch'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { type ProxyPoolDto, ProxyPoolSchema } from '@/lib/api/dtos/proxy-pool/schema'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

interface PoolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type AbstractFormProps = PoolDialogProps & {
  defaultValues: ProxyPoolDto
  mutation: {
    mutateAsync: (value: ProxyPoolDto) => Promise<unknown>
    isPending: boolean
  }
  isEdit?: boolean
}

const SWITCHES = [
  {
    name: 'enabled',
    icon: IconPower,
    label: 'Enabled',
    note: 'When off, bound accounts connect directly',
  },
  {
    name: 'strict',
    icon: IconLock,
    label: 'Strict mode',
    note: 'When the proxy is unreachable, fail requests instead of retrying directly',
  },
] as const

function AbstractForm({ open, onOpenChange, defaultValues, mutation, isEdit }: AbstractFormProps) {
  const id = useId()
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ProxyPoolSchema,
      onChange: ProxyPoolSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync({
          ...value,
          name: value.name.trim(),
          url: value.url.trim(),
          // Not shown in this form; kept so editing does not clear it.
          label: value.label || undefined,
          bypass: value.bypass?.trim(),
        })
        toast.success(isEdit ? 'Proxy pool updated' : 'Proxy pool created')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit proxy pool' : 'Add proxy pool'}
      description="Accounts bound to this pool send their upstream traffic through it."
      confirmText={isEdit ? 'Save changes' : 'Create pool'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField label="Name" placeholder="eu-residential" autoComplete="off" asterisk />
        )}
      />

      <div className="space-y-1.5">
        <form.AppField
          name="url"
          children={(field) => (
            <field.TextField
              label="Proxy URL"
              placeholder="http://user:pass@host:port"
              className="font-mono"
              autoComplete="off"
              asterisk
            />
          )}
        />
        <p className="text-xs text-muted-foreground">HTTP, HTTPS or SOCKS5, credentials inline</p>
      </div>

      <div className="space-y-1.5">
        <form.AppField
          name="bypass"
          children={(field) => (
            <field.TextField
              label="Bypass hosts"
              hint="Optional"
              placeholder="localhost,127.0.0.1,.internal"
              className="font-mono"
              autoComplete="off"
            />
          )}
        />
        <p className="text-xs text-muted-foreground">Comma separated; these connect directly</p>
      </div>

      <div className="divide-y divide-border rounded-md border border-border">
        {SWITCHES.map((s) => (
          <form.AppField
            key={s.name}
            name={s.name}
            children={(field) => (
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <div className="flex min-w-0 gap-2.5">
                  <s.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <label htmlFor={`${id}-${s.name}`} className="block text-[13px] font-medium">
                      {s.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{s.note}</p>
                  </div>
                </div>
                <Switch
                  id={`${id}-${s.name}`}
                  checked={field.state.value ?? false}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          />
        ))}
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

export function AddProxyPoolForm({ open, onOpenChange }: PoolDialogProps) {
  const mutation = useMutation(queries.proxyPools.create())
  return (
    <AbstractForm
      // Keyed by open state so every open starts from an empty form.
      key={String(open)}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{ name: '', url: '', bypass: '', enabled: true, strict: false }}
      mutation={mutation}
    />
  )
}

export function EditProxyPoolForm({
  pool,
  open,
  onOpenChange,
}: PoolDialogProps & { pool: Models.ProxyPool }) {
  const update = useMutation(queries.proxyPools.update())
  return (
    <AbstractForm
      key={`${pool.id}-${open}`}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: pool.name,
        url: pool.url,
        label: pool.label,
        bypass: pool.bypass ?? '',
        enabled: pool.enabled ?? true,
        strict: pool.strict ?? false,
      }}
      mutation={{
        mutateAsync: (reqBody) => update.mutateAsync({ id: pool.id, reqBody }),
        isPending: update.isPending,
      }}
      isEdit
    />
  )
}
