import { IconPuzzle } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CreateSkillDto } from '@/lib/api/dtos/skill/schema'
import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import CreateSkillDialog from '@/components/block/traffic/skills/create-skill-dialog'
import CustomSkillsCard from '@/components/block/traffic/skills/custom-skills-card'
import ReferenceSkillsCard from '@/components/block/traffic/skills/reference-skills-card'
import SkillTemplatesCard from '@/components/block/traffic/skills/skill-templates-card'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/skills/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ initial?: CreateSkillDto } | null>(null)

  const { data, isFetching, isLoading } = useQuery(queries.skills.list())
  const skills = data?.data ?? []

  const createMutation = useMutation(queries.skills.create())
  const toggleMutation = useMutation(queries.skills.setEnabled())
  const deleteMutation = useMutation(queries.skills.delete())

  const handleCreate = async (payload: CreateSkillDto) => {
    await createMutation.mutateAsync(payload)
    toast.success('Skill created')
  }

  const handleToggle = async (skill: Models.Skill, enabled: boolean) => {
    setTogglingId(skill.id)

    try {
      await toggleMutation.mutateAsync({ id: skill.id, enabled })
      toast.success(enabled ? 'Skill switched on for every request' : 'Skill switched off')
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (skill: Models.Skill) => {
    setDeletingId(skill.id)

    try {
      await deleteMutation.mutateAsync(skill.id)
      toast.success('Skill deleted')
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconPuzzle}
        title="Skills"
        description="Standing instructions the gateway adds to chat requests, plus reference docs that teach agents to use Tera Router."
      />

      <CustomSkillsCard
        skills={skills}
        loading={isFetching || isLoading}
        deletingId={deletingId}
        togglingId={togglingId}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onCreate={() => setCreating({})}
        templatesHref="#skill-templates"
      />
      <SkillTemplatesCard
        id="skill-templates"
        onUse={({ name, description, prompt }) =>
          setCreating({ initial: { name, description, prompt } })
        }
      />
      <ReferenceSkillsCard />

      <CreateSkillDialog
        open={creating !== null}
        onOpenChange={(open) => !open && setCreating(null)}
        initial={creating?.initial}
        onSubmit={handleCreate}
      />
    </div>
  )
}
