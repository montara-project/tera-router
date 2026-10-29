'use client'

import { IconBook2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'

import IconBadge from '@/components/block/common/icon-badge'
import CopySkillButton from '@/components/block/traffic/skills/copy-skill-button'
import DialogContent, {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { skillUrl } from '@/lib/constants/skill'

// The markdown pipeline (micromark, GFM) is only needed once a skill is opened;
// the query starts loading it alongside the doc fetch.
const loadSkillMarkdown = () => import('@/components/block/traffic/skills/skill-markdown')
const SkillMarkdown = lazy(loadSkillMarkdown)

/** The skill the dialog shows: a reference slug or a custom skill id. */
export type SkillDetailTarget = { slug: string; name: string }

interface SkillDetailDialogProps {
  skill: SkillDetailTarget | null
  onClose: () => void
}

/**
 * Splits a SKILL.md into its frontmatter description and markdown body.
 * The server writes `description` as a plain or JSON-quoted scalar.
 */
function parseSkillDoc(doc: string) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(doc)
  if (!match) return { description: '', body: doc }
  const raw = /^description:\s*(.*)$/m.exec(match[1])?.[1]?.trim() ?? ''
  let description = raw
  try {
    if (raw.startsWith('"')) description = JSON.parse(raw)
  } catch {
    // Not valid JSON: show the scalar as written.
  }
  return { description, body: doc.slice(match[0].length) }
}

const DOC_SKELETON = (
  <div className="space-y-3">
    <Skeleton className="h-5 w-1/3 rounded-lg" />
    <Skeleton className="h-4 w-full rounded-lg" />
    <Skeleton className="h-4 w-5/6 rounded-lg" />
    <Skeleton className="h-24 w-full rounded-lg" />
  </div>
)

export default function SkillDetailDialog({ skill, onClose }: SkillDetailDialogProps) {
  const url = skill ? skillUrl(skill.slug) : ''
  // The same public SKILL.md an agent fetches, so the preview is exactly
  // what the agent reads.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-doc', url],
    queryFn: async () => {
      void loadSkillMarkdown()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseSkillDoc(await res.text())
    },
    enabled: Boolean(skill),
  })

  const renderDoc = () => {
    if (isLoading) {
      return DOC_SKELETON
    }

    if (isError) {
      return <p className="text-sm text-destructive">Could not load this skill. Try again later.</p>
    }

    return (
      <Suspense fallback={DOC_SKELETON}>
        <SkillMarkdown>{data?.body ?? ''}</SkillMarkdown>
      </Suspense>
    )
  }

  return (
    <Dialog open={Boolean(skill)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <div className="border-b border-border px-6 pt-5 pb-4">
          <div className="flex items-start gap-3 pe-8">
            <IconBadge
              icon={IconBook2}
              variant="soft"
              className="h-10 w-10 shrink-0"
              iconClassName="h-5 w-5"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{skill?.name}</DialogTitle>
              <DialogDescription>{data?.description || 'SKILL.md'}</DialogDescription>
            </div>
            {skill && <CopySkillButton value={url} label={`Copy ${skill.name} skill URL`} />}
          </div>
        </div>

        <DialogBody className="max-h-[70vh] overflow-y-auto px-6 py-4 text-foreground">
          {renderDoc()}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
