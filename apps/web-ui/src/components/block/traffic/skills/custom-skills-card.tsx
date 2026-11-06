'use client'

import { IconArrowDown, IconEye, IconPlus, IconPuzzle, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import type { Models } from '@/lib/api/models'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import CopySkillButton from '@/components/block/traffic/skills/copy-skill-button'
import SkillDetailDialog, {
  type SkillDetailTarget,
} from '@/components/block/traffic/skills/skill-detail-dialog'
import { Button } from '@/components/ui/button'
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
  onCreate: () => void
  /** in-page anchor of the templates section */
  templatesHref: string
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
    // Controls drop under the text on narrow cards instead of squeezing it.
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <p className="text-[13px] font-medium text-foreground">{skill.name}</p>
        {skill.description && <p className="text-xs text-muted-foreground">{skill.description}</p>}
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
  onCreate,
  templatesHref,
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
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconPuzzle className="size-5" aria-hidden />
          </span>
          <p className="mt-3.5 text-sm font-semibold">No custom skills yet</p>
          <p className="mt-1 max-w-xl text-[13px] text-pretty text-muted-foreground">
            Write an instruction once — house style, review rules, a persona — and switch it on to
            add it to every request routed through Tera Router, or pick it per API key on that key's
            Skills tab.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={onCreate}>
              <IconPlus />
              Create skill
            </Button>
            <Button asChild variant="outline">
              <a href={templatesHref}>
                Or start from a template
                <IconArrowDown />
              </a>
            </Button>
          </div>
        </div>
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
    <SectionCardPanel
      icon={IconPuzzle}
      title="Custom skills"
      description="Switched-on skills are added to the system prompt of gateway chat requests — no client changes needed"
      toolbar={
        isEmpty ? undefined : (
          <Button type="button" size="sm" onClick={onCreate}>
            <IconPlus />
            Create skill
          </Button>
        )
      }
    >
      {renderSkills()}
      <SkillDetailDialog skill={viewing} onClose={() => setViewing(null)} />
    </SectionCardPanel>
  )
}
