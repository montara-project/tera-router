import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CustomProviderSchema, type CustomProviderDto } from '@/lib/api/dtos/provider/schema'
import { queries } from '@/lib/api/queries'
import { DIALECT_OPTIONS } from '@/lib/constants/skill'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = CustomProviderDto
type TMutation = CustomProviderDto
type TDto = CustomProviderDto
type TResponse = Models.CustomProvider

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
      const trimmedBaseUrl = value?.base_url?.trim()
      const trimmedAlias = value?.slug?.trim()

      if (trimmedAlias && !/^[a-zA-Z0-9-]{1,32}$/.test(trimmedAlias)) {
        toast.error('Alias may only contain letters, digits, and hyphens (max 32)')
        return
      }

      if (!trimmedBaseUrl || !/^https?:\/\//i.test(trimmedBaseUrl)) {
        toast.error('Base URL must start with http:// or https://')
        return
      }

      try {
        // The custom-<api_kind>- slug marker is a UI convention — the server
        // stores the slug verbatim. Send the composed marker when an alias is
        // set; omit the field so the server can slugify the name otherwise.
        await mutation.mutateAsync({
          ...value,
          slug: trimmedAlias ?? undefined,
          base_url: trimmedBaseUrl,
        })
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
      title={`${isEdit ? 'Edit' : 'Create'} Custom Provider`}
      description="Custom providers are used to authenticate requests to the API."
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField label="Name" placeholder="e.g. Local vLLM or Acme Gateway" asterisk />
        )}
      />

      <form.AppField
        name="api_kind"
        children={(field) => (
          <field.SelectField
            label="Dialect"
            placeholder="Select dialect"
            asterisk
            options={DIALECT_OPTIONS}
          />
        )}
      />

      <form.AppField
        name="base_url"
        children={(field) => (
          <field.TextField label="Base URL" placeholder="https://llm.example.com/v1" asterisk />
        )}
      />

      {/* Slug is immutable after create — accounts and chain steps reference
          the provider by slug, so PATCH ignores it. Only offer the alias
          field on create. */}
      {!isEdit ? (
        <form.AppField
          name="slug"
          children={(field) => <field.TextField label="Alias / prefix" placeholder="e.g. kei-ai" />}
        />
      ) : null}
    </SimpleAlertScrollableDialogForm>
  )
}

type AddCustomProviderFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddCustomProviderForm({ open, onOpenChange }: AddCustomProviderFormProps) {
  const mutation = useMutation(queries.providers.customCreate())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        api_kind: 'openai',
        base_url: '',
        slug: '',
      }}
      schema={CustomProviderSchema}
      mutation={mutation}
    />
  )
}

type EditCustomProviderFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.CustomProvider
}

export function EditCustomProviderForm({
  open,
  onOpenChange,
  record,
}: EditCustomProviderFormProps) {
  const mutation = useMutation(queries.providers.customUpdate(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: record.name,
        api_kind: record.api_kind,
        base_url: record.base_url,
        slug: record.slug,
      }}
      schema={CustomProviderSchema}
      mutation={mutation}
      isEdit
    />
  )
}
