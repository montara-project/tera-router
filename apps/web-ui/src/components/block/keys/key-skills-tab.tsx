import { IconInbox } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { ApiKeyDetail } from '@/lib/api/models/key'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Skills</CardTitle>
          <CardDescription>
            Choose the skills whose prompt is appended to the system prompt of requests made with
            this key.
          </CardDescription>
        </CardHeading>
      </CardHeader>

      <CardContent className="p-0">
        {skillsQuery.isLoading ? (
          <div className="space-y-4 p-5">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : skills.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader className="max-w-xl">
              <EmptyMedia variant="icon" className="size-12 rounded-full">
                <IconInbox />
              </EmptyMedia>
              <EmptyTitle>No custom skills yet</EmptyTitle>
              <EmptyDescription>
                Create one on the{' '}
                <Link to="/skills" className="text-foreground underline">
                  Skills
                </Link>{' '}
                page, then switch it on here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {skills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {skill.name}
                    {skill.enabled ? (
                      <Badge variant="secondary" size="sm">
                        On for every key
                      </Badge>
                    ) : null}
                  </p>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground">{skill.description}</p>
                  )}
                </div>
                {/* A globally enabled skill is injected whatever this key selects. */}
                <Switch
                  size="sm"
                  aria-label={`Use ${skill.name} with this key`}
                  checked={skill.enabled || selected.includes(skill.id)}
                  disabled={skill.enabled || saveMutation.isPending}
                  onCheckedChange={(checked) => handleToggle(skill, checked)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
