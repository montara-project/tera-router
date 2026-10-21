import { createFormHook } from '@tanstack/react-form'
import { type ComponentProps, type ComponentType, lazy, Suspense } from 'react'

import PasswordField from '@/components/block/form/password-field'
import SelectField from '@/components/block/form/select-field'
import SelectGroupField from '@/components/block/form/select-group-field'
import SubmitButton from '@/components/block/form/submit'
import SwitchField from '@/components/block/form/switch-field'
import TextField from '@/components/block/form/text-field'
import TextareaField from '@/components/block/form/textarea-field'

import { fieldContext, formContext } from './form-context'

// Heavy or rarely used fields (lexical, cmdk, day-picker, number-format, slider) load on first use so simple forms like login stay small.
function lazyField<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const Field = lazy(load)
  return (props: ComponentProps<T>) => (
    <Suspense fallback={null}>
      <Field {...props} />
    </Suspense>
  )
}

const CheckboxField = lazyField(() => import('@/components/block/form/checkbox-field'))
const ComboboxField = lazyField(() => import('@/components/block/form/combobox-field'))
const DatePickerField = lazyField(() => import('@/components/block/form/date-picker-field'))
const DateRangePickerField = lazyField(
  () => import('@/components/block/form/date-range-picker-field')
)
const GalleryUploadField = lazyField(() => import('@/components/block/form/gallery-upload-field'))
const NumberField = lazyField(() => import('@/components/block/form/number-field'))
const RatingField = lazyField(() => import('@/components/block/form/rating-field'))
const RichTextEditorField = lazyField(
  () => import('@/components/block/form/rich-text-editor-field')
)
const SliderField = lazyField(() => import('@/components/block/form/slider-field'))

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    NumberField,
    PasswordField,
    SelectField,
    SelectGroupField,
    DatePickerField,
    DateRangePickerField,
    ComboboxField,
    SliderField,
    SwitchField,
    TextareaField,
    RatingField,
    GalleryUploadField,
    RichTextEditorField,
    CheckboxField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
