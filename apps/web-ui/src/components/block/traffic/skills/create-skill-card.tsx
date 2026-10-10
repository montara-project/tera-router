'use client'

import { IconPlus, IconUpload } from '@tabler/icons-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import type { CreateSkillDto } from '@/lib/api/dtos/skill/schema'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { CreateSkillSchema } from '@/lib/api/dtos/skill/schema'
import { MAX_SKILL_FILE_BYTES, parseSkillFile } from '@/lib/skill-file'

interface CreateSkillCardProps {
  onSubmit: (payload: CreateSkillDto) => Promise<void>
}

export default function CreateSkillCard({ onSubmit }: CreateSkillCardProps) {
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const form = useAppForm({
    defaultValues: {
      name: '',
      description: '',
      prompt: '',
    },
    validators: {
      onSubmit: CreateSkillSchema,
    },
    onSubmit: async ({ value }) => {
      setSubmitting(true)

      try {
        await onSubmit(value)
        form.reset()
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
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <IconBadge icon={IconPlus} variant="soft" className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>Create skill</CardTitle>
            <CardDescription>
              Give the skill a name and its instruction, or upload a SKILL.md to fill the form. New
              skills start switched off.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <form.AppField
              name="name"
              children={(field) => <field.TextField label="Name" placeholder="Concise reviewer" />}
            />
            <form.AppField
              name="description"
              children={(field) => (
                <field.TextField label="Description" placeholder="Short summary of what it does" />
              )}
            />
          </div>

          <form.AppField
            name="prompt"
            children={(field) => (
              <field.TextareaField
                label="Prompt"
                placeholder="You are a meticulous code reviewer. Prefer small, safe diffs..."
                rows={4}
              />
            )}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
            >
              <IconPlus />
              <span>{submitting ? 'Creating...' : 'Create skill'}</span>
            </Button>
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
              disabled={submitting}
              onClick={() => fileInput.current?.click()}
            >
              <IconUpload />
              <span>Upload SKILL.md</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
