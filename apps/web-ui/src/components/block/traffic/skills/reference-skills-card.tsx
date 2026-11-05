import { IconBook2, IconCheck, IconCopy, IconEye } from '@tabler/icons-react'
import { useState } from 'react'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import SkillDetailDialog, {
  type SkillDetailTarget,
} from '@/components/block/traffic/skills/skill-detail-dialog'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { agentPrompt, REFERENCE_SKILLS, skillUrl, type ReferenceSkill } from '@/lib/constants/skill'

/** Button that copies a value and says so for a moment. */
function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  ariaLabel,
  ...props
}: React.ComponentProps<typeof Button> & {
  value: string
  label: string
  copiedLabel?: string
  ariaLabel?: string
}) {
  const { copy, copied } = useCopyToClipboard()
  return (
    <Button type="button" aria-label={ariaLabel} onClick={() => copy(value)} {...props}>
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? copiedLabel : label}
    </Button>
  )
}

function SkillTile({ icon: Icon }: { icon: ReferenceSkill['icon'] }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
      <Icon className="size-4" aria-hidden />
    </span>
  )
}

export default function ReferenceSkillsCard() {
  const [viewing, setViewing] = useState<SkillDetailTarget | null>(null)
  const [entry, ...endpoints] = REFERENCE_SKILLS
  const entryUrl = skillUrl(entry.slug)

  return (
    <DashboardPanel
      icon={IconBook2}
      title={
        <>
          Reference skills
          <span className="font-normal text-muted-foreground tabular-nums">
            {REFERENCE_SKILLS.length}
          </span>
        </>
      }
      description="Paste a link into Claude, Cursor, ChatGPT or any agent to teach it a Tera Router endpoint"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <entry.icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[13px] font-medium">{entry.name}</p>
          <p className="text-xs text-muted-foreground">{entry.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton
            variant="outline"
            value={entryUrl}
            label="Copy URL"
            ariaLabel={`Copy ${entry.name} skill URL`}
          />
          <CopyButton value={agentPrompt(entryUrl)} label="Copy agent prompt" />
        </div>
      </div>

      <ul className="-me-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3">
        {endpoints.map((skill) => (
          <li
            key={skill.slug}
            className="flex flex-col gap-2 border-e border-b border-border px-4 py-3"
          >
            <div className="flex items-start gap-2.5">
              <SkillTile icon={skill.icon} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium">
                  {skill.name}
                  <span className="text-[11.5px] font-normal text-muted-foreground">
                    {skill.category}
                  </span>
                </p>
                {skill.endpoint && (
                  <code className="font-mono text-[11.5px] break-all text-muted-foreground">
                    {skill.endpoint}
                  </code>
                )}
              </div>
            </div>
            <p className="flex-1 text-xs text-muted-foreground">{skill.description}</p>
            {skill.comingSoon ? (
              <p className="text-xs text-muted-foreground">Coming soon</p>
            ) : (
              <div className="-ms-2 flex gap-0.5">
                <CopyButton
                  variant="ghost"
                  size="sm"
                  value={skillUrl(skill.slug)}
                  label="Copy URL"
                  ariaLabel={`Copy ${skill.name} skill URL`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`View ${skill.name} skill`}
                  onClick={() => setViewing({ slug: skill.slug, name: skill.name })}
                >
                  <IconEye />
                  View
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <SkillDetailDialog skill={viewing} onClose={() => setViewing(null)} />
    </DashboardPanel>
  )
}
