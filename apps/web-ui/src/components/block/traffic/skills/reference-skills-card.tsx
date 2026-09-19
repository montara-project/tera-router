'use client'

import { IconBook2 } from '@tabler/icons-react'

import IconBadge from '@/components/block/common/icon-badge'
import CopySkillButton from '@/components/block/traffic/skills/copy-skill-button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { REFERENCE_SKILLS, skillUrl, type ReferenceSkill } from '@/lib/constants/skill'

function ReferenceSkillRow({ skill }: { skill: ReferenceSkill }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{skill.name}</p>
        <p className="text-sm text-muted-foreground">{skill.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {skill.endpoint && (
          <code className="hidden rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:inline-block">
            {skill.endpoint}
          </code>
        )}
        <CopySkillButton value={skillUrl(skill.slug)} label={`Copy ${skill.name} skill URL`} />
      </div>
    </div>
  )
}

export default function ReferenceSkillsCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconBook2}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Reference skills</CardTitle>
            <CardDescription>
              Copy a skill URL and paste it to your AI agent to teach it how to use KeiRouter
              endpoints.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {REFERENCE_SKILLS.map((skill) => (
            <ReferenceSkillRow key={skill.slug} skill={skill} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
