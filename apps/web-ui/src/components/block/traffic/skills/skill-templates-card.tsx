import { IconArrowRight, IconTemplate } from '@tabler/icons-react'
import { useState } from 'react'

import SegmentedControl from '@/components/block/common/segmented-control'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import {
  estimateTokens,
  SKILL_TEMPLATE_CATEGORIES,
  SKILL_TEMPLATES,
  type SkillTemplate,
} from '@/lib/constants/skill-templates'

/** Templates shown before "Show all". */
const COLLAPSED_COUNT = 6

interface SkillTemplatesCardProps {
  onUse: (template: SkillTemplate) => void
  id?: string
}

export default function SkillTemplatesCard({ onUse, id }: SkillTemplatesCardProps) {
  const [category, setCategory] = useState('all')
  const [expanded, setExpanded] = useState(false)

  const matching =
    category === 'all' ? SKILL_TEMPLATES : SKILL_TEMPLATES.filter((t) => t.category === category)
  const visible = expanded ? matching : matching.slice(0, COLLAPSED_COUNT)

  return (
    <div id={id} className="scroll-mt-4">
      <DashboardPanel
        icon={IconTemplate}
        title={
          <>
            Templates
            <span className="font-normal text-muted-foreground tabular-nums">
              {SKILL_TEMPLATES.length}
            </span>
          </>
        }
        description="Ready-made skills and personas for common use cases — pick one, then tailor it in the editor"
      >
        <div className="border-b border-border px-4 py-3">
          <SegmentedControl
            aria-label="Template category"
            className="max-w-full overflow-x-auto"
            value={category}
            onChange={(value) => {
              setCategory(value)
              setExpanded(false)
            }}
            options={[
              { value: 'all', label: 'All' },
              ...SKILL_TEMPLATE_CATEGORIES.map(({ value, label }) => ({
                value: value as string,
                label,
              })),
            ]}
          />
        </div>

        <ul className="-me-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => (
            <li key={template.name} className="border-e border-b border-border">
              <TemplateCard template={template} onUse={onUse} />
            </li>
          ))}
        </ul>

        {matching.length > COLLAPSED_COUNT && (
          <div className="border-t border-border px-4 py-2">
            <Button
              type="button"
              variant="outline"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Show fewer' : `Show all ${matching.length} templates`}
            </Button>
          </div>
        )}
      </DashboardPanel>
    </div>
  )
}

function TemplateCard({
  template,
  onUse,
}: {
  template: SkillTemplate
  onUse: (template: SkillTemplate) => void
}) {
  const category = SKILL_TEMPLATE_CATEGORIES.find((c) => c.value === template.category)
  const Icon = category?.icon ?? IconTemplate

  return (
    <button
      type="button"
      onClick={() => onUse(template)}
      aria-label={`Use template: ${template.name}`}
      className="group flex h-full w-full flex-col gap-2 px-4 py-3 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden focus-visible:ring-inset"
    >
      <span className="flex items-start gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-400">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium">
            {template.name}
            <span className="text-[11.5px] font-normal text-muted-foreground">
              {category?.label}
            </span>
          </span>
          <span className="block text-xs text-muted-foreground">{template.description}</span>
        </span>
      </span>
      <span className="flex items-center gap-2 ps-[38px] text-[11.5px]">
        <span className="text-muted-foreground tabular-nums">
          ~{estimateTokens(template.prompt)} tokens
        </span>
        <span className="text-primary inline-flex items-center gap-1 font-medium group-hover:underline">
          Use template
          <IconArrowRight className="size-3.5" aria-hidden />
        </span>
      </span>
    </button>
  )
}
