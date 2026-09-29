import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CreateSkillDto } from '@/lib/api/dtos/skill/schema'
import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import CreateSkillCard from '@/components/block/traffic/skills/create-skill-card'
import CustomSkillsCard from '@/components/block/traffic/skills/custom-skills-card'
import ReferenceSkillsCard from '@/components/block/traffic/skills/reference-skills-card'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/skills/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isFetching, isLoading } = useQuery(queries.skills.list())
  const skills = data?.data ?? []

  const createMutation = useMutation(queries.skills.create())
  const deleteMutation = useMutation(queries.skills.delete())

  const handleCreate = async (payload: CreateSkillDto) => {
    await createMutation.mutateAsync(payload)
    toast.success('Skill created')
  }

  const handleDelete = async (skill: Models.Skill) => {
    setDeletingId(skill.id)

    try {
      await deleteMutation.mutateAsync(skill.id)
      toast.success('Skill deleted')
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
