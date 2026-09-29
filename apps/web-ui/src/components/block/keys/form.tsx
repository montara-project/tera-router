import { useMutation } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  CreateKeySchema,
  UpdateKeySchema,
  type CreateKeyDto,
  type UpdateKeyDto,
} from '@/lib/api/dtos/key/schema'
import { queries } from '@/lib/api/queries'

import SimpleAlertScrollableDialogForm from '../common/simple-alert-scrollable-dialog-form'

type TModel = CreateKeyDto
type TMutation = CreateKeyDto
type TDto = CreateKeyDto | UpdateKeyDto
type TResponse = Models.ApiKey

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
        await mutation.mutateAsync(value)
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
      title={`${isEdit ? 'Edit' : 'Create'} Api Key`}
      description="Api Key are used to authenticate requests to the API."
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => <field.TextField label="Name" placeholder="Enter key name" asterisk />}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddKeyForm({ open, onOpenChange }: AddKeyFormProps) {
  const mutation = useMutation(queries.keys.create())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
      }}
      schema={CreateKeySchema}
      mutation={mutation}
    />
  )
}

type EditKeyFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: Models.ApiKey
}

export function EditKeyForm({ open, onOpenChange, record }: EditKeyFormProps) {
  const mutation = useMutation(queries.keys.update(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: record.name,
      }}
      schema={UpdateKeySchema}
      mutation={mutation}
      isEdit
    />
  )
}
