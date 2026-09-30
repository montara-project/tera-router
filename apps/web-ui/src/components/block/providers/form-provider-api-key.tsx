import { useMutation } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AccountSchema, type AccountDto } from '@/lib/api/dtos/account/schema'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = AccountDto
type TMutation = AccountDto
type TDto = AccountDto
type TResponse = Models.Account

type AbstractFormProps = Omit<BaseAbstractForm<TModel, TMutation, TDto, TResponse>, 'mutation'> & {
  mutation: {
    mutateAsync: (value: TMutation) => Promise<unknown>
    isPending: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: Models.CustomProvider
}

function AbstractForm({
  open,
  onOpenChange,
  defaultValues,
  schema,
  mutation,
  isEdit,
  provider,
}: AbstractFormProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(value)
      } catch (error) {
        toastAxiosError(error)
      } finally {
        form.reset()
        onOpenChange(false)
      }
    },
  })

  console.log(form.state.errors)

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title="Add API key"
      description={`Add a credential for ${provider.name}. The key is encrypted before storage.`}
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="label"
        children={(field) => (
          <field.TextField label="Label" placeholder="e.g. Production key" asterisk />
        )}
      />

      <form.AppField
        name="api_key"
        children={(field) => <field.PasswordField label="API Key" placeholder="sk-..." asterisk />}
      />

      <form.AppField
        name="priority"
        children={(field) => (
          <field.TextField
            label="Priority"
            type="number"
            autoComplete="new-password"
            placeholder="100"
            asterisk
          />
        )}
      />
      <p className="text-xs text-muted-foreground">Lower priority numbers are tried first.</p>
    </SimpleAlertScrollableDialogForm>
  )
}

type AddCustomProviderApiKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: Models.CustomProvider
}

export function AddCustomProviderApiKeyForm({
  open,
  onOpenChange,
  provider,
}: AddCustomProviderApiKeyFormProps) {
  const mutation = useMutation(queries.accounts.create())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        provider: provider.slug,
        label: '',
        auth_kind: 'api_key',
        api_key: '',
        priority: 100,
      }}
      schema={AccountSchema}
      mutation={mutation}
      provider={provider}
    />
  )
}
