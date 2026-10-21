'use client'

import { IconEye, IconInbox, IconPuzzle, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import IconBadge from '@/components/block/common/icon-badge'
import CopySkillButton from '@/components/block/traffic/skills/copy-skill-button'
import SkillDetailDialog, {
  type SkillDetailTarget,
} from '@/components/block/traffic/skills/skill-detail-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { skillUrl } from '@/lib/constants/skill'

interface CustomSkillsCardProps {
  skills: Models.Skill[]
  loading?: boolean
  deletingId?: string | null
  togglingId?: string | null
  onToggle: (skill: Models.Skill, enabled: boolean) => void
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
  toggling,
  onToggle,
  onDelete,
  onView,
}: {
  skill: Models.Skill
  deleting: boolean
  toggling: boolean
  onToggle: (skill: Models.Skill, enabled: boolean) => void
  onDelete: (skill: Models.Skill) => void
  onView: (skill: Models.Skill) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{skill.name}</p>
        {skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          size="sm"
          className="me-1.5"
          aria-label={`Inject ${skill.name} into every request`}
          checked={skill.enabled}
          disabled={toggling}
          onCheckedChange={(checked) => onToggle(skill, checked)}
        />
        <Button
          type="button"
          variant="ghost"
          mode="icon"
          size="icon"
          aria-label={`View ${skill.name} skill`}
          onClick={() => onView(skill)}
        >
          <IconEye className="text-muted-foreground" />
        </Button>
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
  togglingId = null,
  onToggle,
  onDelete,
}: CustomSkillsCardProps) {
  const isEmpty = skills.length === 0
  const [viewing, setViewing] = useState<SkillDetailTarget | null>(null)

  const renderSkills = () => {
    if (loading && isEmpty) {
      return (
        <div className="p-5">
          <CustomSkillsLoading />
        </div>
      )
    }

    if (isEmpty) {
      return (
        <EmptyState
          icon={IconInbox}
          title="No custom skills yet"
          description="Create a skill, then switch it on to add its prompt to every request."
        />
      )
    }

    return (
      <div className="divide-y divide-border">
        {skills.map((skill) => (
          <CustomSkillRow
            key={skill.id}
            skill={skill}
            deleting={deletingId === skill.id}
            toggling={togglingId === skill.id}
            onToggle={onToggle}
            onView={(s) => setViewing({ slug: s.id, name: s.name })}
            onDelete={onDelete}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconPuzzle}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Custom skills</CardTitle>
            <CardDescription>
              Switch a skill on to append its prompt to every gateway request, pick it per API key
              on that key's Skills tab, or copy its URL for an agent to read.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent className="p-0">{renderSkills()}</CardContent>
      <SkillDetailDialog skill={viewing} onClose={() => setViewing(null)} />
    </Card>
  )
}
