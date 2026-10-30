import { createFormHook } from '@tanstack/react-form'
import { type ComponentProps, type ComponentType, lazy, Suspense } from 'react'

import PasswordField from '@/components/block/form/password-field'
import SelectField from '@/components/block/form/select-field'
import SubmitButton from '@/components/block/form/submit'
import TextField from '@/components/block/form/text-field'
import TextareaField from '@/components/block/form/textarea-field'

import { fieldContext, formContext } from './form-context'

// Heavy or rarely used fields (cmdk, number-format) load on first use so simple forms like login stay small.
function lazyField<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const Field = lazy(load)
  return (props: ComponentProps<T>) => (
    <Suspense fallback={null}>
      <Field {...props} />
    </Suspense>
  )
}

const ComboboxField = lazyField(() => import('@/components/block/form/combobox-field'))
const NumberField = lazyField(() => import('@/components/block/form/number-field'))

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    NumberField,
    PasswordField,
    SelectField,
    ComboboxField,
    TextareaField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
