'use client'

import { IconInbox, IconPuzzle, IconTrash } from '@tabler/icons-react'

import type { Models } from '@/lib/api/models'

import IconBadge from '@/components/block/common/icon-badge'
import CopySkillButton from '@/components/block/traffic/skills/copy-skill-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { skillUrl } from '@/lib/constants/skill'

interface CustomSkillsCardProps {
  skills: Models.Skill[]
  loading?: boolean
  deletingId?: string | null
  onDelete: (skill: Models.Skill) => void
}

function CustomSkillsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}

function CustomSkillRow({
  skill,
  deleting,
  onDelete,
}: {
  skill: Models.Skill
  deleting: boolean
  onDelete: (skill: Models.Skill) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{skill.name}</p>
        {skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CopySkillButton value={skillUrl(skill.id)} label={`Copy ${skill.name} skill URL`} />
        <Button
          type="button"
          variant="ghost"
          mode="icon"
          size="icon"
          aria-label={`Delete ${skill.name}`}
          disabled={deleting}
          onClick={() => onDelete(skill)}
        >
          <IconTrash className="text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  )
}

export default function CustomSkillsCard({
  skills,
  loading = false,
  deletingId = null,
  onDelete,
}: CustomSkillsCardProps) {
  const isEmpty = skills.length === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconPuzzle}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardTitle>Custom skills</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && isEmpty ? (
          <div className="p-5">
            <CustomSkillsLoading />
          </div>
        ) : isEmpty ? (
          <Empty className="py-14">
            <EmptyHeader className="max-w-xl">
              <EmptyMedia variant="icon" className="size-12 rounded-full">
                <IconInbox />
              </EmptyMedia>
              <EmptyTitle>No custom skills yet</EmptyTitle>
              <EmptyDescription>
                Create a skill to augment matching requests with a system prompt.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {skills.map((skill) => (
              <CustomSkillRow
                key={skill.id}
                skill={skill}
                deleting={deletingId === skill.id}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
