import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { ProxyPoolSchema, type ProxyPoolDto } from '@/lib/api/dtos/proxy-pool/schema'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = ProxyPoolDto
type TMutation = ProxyPoolDto
type TDto = ProxyPoolDto
type TResponse = Models.ProxyPool

type AbstractFormProps = Omit<BaseAbstractForm<TModel, TMutation, TDto, TResponse>, 'mutation'> & {
  mutation: {
    mutateAsync: (value: TMutation) => Promise<unknown>
    isPending: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AbstractForm({
  open,
  onOpenChange,
  defaultValues,
  schema,
  mutation,
  isEdit,
}: AbstractFormProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync({
          ...value,
          name: value.name.trim(),
          url: value.url.trim(),
          label: value.label?.trim() || undefined,
        })
        toast.success(isEdit ? 'Proxy pool updated' : 'Proxy pool created')
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
        onOpenChange(false)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={`${isEdit ? 'Edit' : 'Add'} Proxy Pool`}
      description="Register an outbound proxy exit. The pool is tested before it is marked active."
      confirmText={isEdit ? 'Update' : 'Add pool'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField label="Name" placeholder="cloudflare-relay" asterisk />
        )}
      />

      <form.AppField
        name="url"
        children={(field) => (
          <field.TextField label="URL" placeholder="https://relay.example.workers.dev" asterisk />
        )}
      />

      <form.AppField
        name="label"
        children={(field) => (
          <field.TextField label="Label (optional)" placeholder="cloudflare relay" />
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddProxyPoolFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProxyPoolForm({ open, onOpenChange }: AddProxyPoolFormProps) {
  const mutation = useMutation(queries.proxyPools.create())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        url: '',
        label: '',
      }}
      schema={ProxyPoolSchema}
      mutation={mutation}
    />
  )
}
