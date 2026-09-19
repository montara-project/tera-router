import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CreateSkillDto } from '@/lib/api/dtos/skill/schema'
import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import CreateSkillCard from '@/components/block/traffic/skills/create-skill-card'
import CustomSkillsCard from '@/components/block/traffic/skills/custom-skills-card'
import ReferenceSkillsCard from '@/components/block/traffic/skills/reference-skills-card'
import { SKILL_QUERY_KEY, skillQueries } from '@/lib/api/queries/skill'
import { services } from '@/lib/api/services'

export const Route = createFileRoute('/(protected)/(traffic)/skills/')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isFetching, isLoading } = useQuery(skillQueries.list())
  const skills = data?.data ?? []

  const refresh = () => queryClient.invalidateQueries({ queryKey: [SKILL_QUERY_KEY] })

  const handleCreate = async (payload: CreateSkillDto) => {
    await services.skills.store(payload)
    toast.success('Skill created')
    await refresh()
  }

  const handleDelete = async (skill: Models.Skill) => {
    setDeletingId(skill.id)

    try {
      await services.skills.remove(skill.id)
      toast.success('Skill deleted')
      await refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <SectionCard
      title="Skills"
      description="Reference docs for AI agents and reusable system-prompt augmentations."
    >
      <div className="space-y-4">
        <ReferenceSkillsCard />
        <CreateSkillCard onSubmit={handleCreate} />
        <CustomSkillsCard
          skills={skills}
          loading={isFetching || isLoading}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      </div>
    </SectionCard>
  )
}
