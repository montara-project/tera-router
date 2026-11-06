import { IconPuzzle } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { ApiKeyDetail } from '@/lib/api/models/key'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export default function KeySkillsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const skillsQuery = useQuery(queries.skills.list())
  const skills = skillsQuery.data?.data ?? []

  const saveMutation = useMutation(queries.keys.update(apiKey.id))

  // A dashboard deploy can briefly outrun the API; treat a missing field as
  // "no skills selected" rather than crashing on undefined.
  const selected = apiKey.skill_ids ?? []

  const handleToggle = (skill: Models.Skill, checked: boolean) => {
    // Rebuilt in skill-list order from the skills that exist, so the saved
    // selection never carries an id the server no longer knows.
    const next = skills
      .filter((item) => (item.id === skill.id ? checked : selected.includes(item.id)))
      .map((item) => item.id)

    saveMutation.mutate(
      { skill_ids: next },
      {
        onSuccess: () => {
          toast.success(
            checked ? `${skill.name} added to this key` : `${skill.name} removed from this key`
          )
        },
        onError: toastAxiosError,
      }
    )
  }

  const activeCount = skills.filter((skill) => skill.enabled || selected.includes(skill.id)).length

  const renderSkills = () => {
    if (skillsQuery.isLoading) {
      return (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )
    }

    if (skills.length === 0) {
      return (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <IconPuzzle className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-[13px] font-semibold">No skills yet</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Create one on the{' '}
            <Link to="/skills" className="text-primary rounded-sm font-medium hover:underline">
              Skills
            </Link>{' '}
            page, then switch it on here.
          </p>
        </div>
      )
    }

    return (
      <ul className="divide-y divide-border">
        {skills.map((skill) => (
          <li key={skill.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                {skill.name}
                {skill.enabled ? (
                  <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                    On for every key
                  </span>
                ) : null}
              </p>
              {skill.description && (
                <p className="text-xs text-muted-foreground">{skill.description}</p>
              )}
            </div>
            {/* A globally enabled skill is injected whatever this key selects. */}
            <Switch
              aria-label={`Use ${skill.name} with this key`}
              checked={skill.enabled || selected.includes(skill.id)}
              disabled={skill.enabled || saveMutation.isPending}
              onCheckedChange={(checked) => handleToggle(skill, checked)}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <SectionCardPanel
      icon={IconPuzzle}
      title={
        <>
          Skills
          {skills.length > 0 ? (
            <span className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground tabular-nums">
              {activeCount} of {skills.length} on
            </span>
          ) : null}
        </>
      }
      description="Appended to the system prompt of requests made with this key"
      action={{ label: 'Manage skills', to: '/skills' }}
    >
      {renderSkills()}
    </SectionCardPanel>
  )
}
