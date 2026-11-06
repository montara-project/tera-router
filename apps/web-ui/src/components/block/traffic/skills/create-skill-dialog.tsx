'use client'

import { IconUpload } from '@tabler/icons-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import type { CreateSkillDto } from '@/lib/api/dtos/skill/schema'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CreateSkillSchema } from '@/lib/api/dtos/skill/schema'
import { MAX_SKILL_FILE_BYTES, parseSkillFile } from '@/lib/skill-file'

interface CreateSkillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefilled values, e.g. from a template. */
  initial?: CreateSkillDto
  onSubmit: (payload: CreateSkillDto) => Promise<void>
}

/** Keyed by open state and template so every open starts from fresh values. */
export default function CreateSkillDialog(props: CreateSkillDialogProps) {
  return <CreateSkillForm key={`${props.open}-${props.initial?.name ?? ''}`} {...props} />
}

function CreateSkillForm({ open, onOpenChange, initial, onSubmit }: CreateSkillDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const form = useAppForm({
    defaultValues: initial ?? { name: '', description: '', prompt: '' },
    validators: {
      onSubmit: CreateSkillSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitting(true)

      try {
        await onSubmit(value)
        onOpenChange(false)
      } catch (error) {
        // Keep what the user typed so a failed create can be retried.
        toastAxiosError(error)
      } finally {
        setSubmitting(false)
      }
    },
  })

  // An uploaded file only fills the form: the skill is saved when the user
  // submits, so the prompt can be read first — an enabled skill ends up in
  // the system prompt of real requests.
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_SKILL_FILE_BYTES) {
      toast.error(`${file.name} is larger than ${MAX_SKILL_FILE_BYTES / 1024} KB.`)
      return
    }

    const skill = parseSkillFile(await file.text(), file.name)
    if (!skill.prompt) {
      toast.error(`${file.name} has no prompt text.`)
      return
    }

    form.setFieldValue('name', skill.name)
    form.setFieldValue('description', skill.description)
    form.setFieldValue('prompt', skill.prompt)
    toast.success(`Loaded ${file.name} — review it, then create the skill`)
  }

  return (
    <SimpleAlertScrollableDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="Create skill"
      description="Give the skill a name and its instruction, or upload a SKILL.md to fill the form. New skills start switched off."
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      confirmText="Create skill"
      loading={submitting}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.AppField
          name="name"
          children={(field) => (
            <field.TextField label="Name" hint="Required" placeholder="Concise reviewer" />
          )}
        />
        <form.AppField
          name="description"
          children={(field) => (
            <field.TextField
              label="Description"
              hint="Optional"
              placeholder="Short summary of what it does"
            />
          )}
        />
      </div>

      <form.AppField
        name="prompt"
        children={(field) => (
          <field.TextareaField
            label="Prompt"
            placeholder="You are a meticulous code reviewer. Prefer small, safe diffs..."
            rows={8}
          />
        )}
      />

      <div>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={() => fileInput.current?.click()}
        >
          <IconUpload />
          <span>Upload SKILL.md</span>
        </Button>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
