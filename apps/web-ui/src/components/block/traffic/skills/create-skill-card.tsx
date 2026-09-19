'use client'

import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

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
import { CreateSkillSchema } from '@/lib/api/dtos/skill/schema'

interface CreateSkillCardProps {
  onSubmit: (payload: CreateSkillDto) => Promise<void>
}

export default function CreateSkillCard({ onSubmit }: CreateSkillCardProps) {
  const [submitting, setSubmitting] = useState(false)

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
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge icon={IconPlus} variant="soft" className="h-10 w-10" iconClassName="h-5 w-5" />
          <CardHeading>
            <CardTitle>Create skill</CardTitle>
            <CardDescription>
              Give the skill a name and the instruction it should inject.
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

          <div>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
            >
              <IconPlus />
              <span>{submitting ? 'Creating...' : 'Create skill'}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
