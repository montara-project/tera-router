'use client'

import type { Components } from 'react-markdown'

import { IconBook2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

// Tailwind styling per element, in place of a typography plugin. `node` is
// react-markdown's AST node; it must not reach the DOM.
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 className="mt-6 mb-3 text-xl font-semibold first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mt-6 mb-3 border-b border-border pb-1.5 text-base font-semibold" {...props} />
  ),
  h3: ({ node: _node, ...props }) => <h3 className="mt-5 mb-2 text-sm font-semibold" {...props} />,
  p: ({ node: _node, ...props }) => <p className="my-3 text-sm leading-6" {...props} />,
  ul: ({ node: _node, ...props }) => (
    <ul className="my-3 list-disc space-y-1 ps-5 text-sm leading-6" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="my-3 list-decimal space-y-1 ps-5 text-sm leading-6" {...props} />
  ),
  a: ({ node: _node, children, ...props }) => (
    <a
      className="font-medium text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs leading-5 [&>code]:bg-transparent [&>code]:p-0"
      {...props}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th className="bg-muted/60 px-3 py-2 text-xs font-semibold" {...props} />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-t border-border px-3 py-2 align-top" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="my-3 border-s-2 border-border ps-3 text-muted-foreground" {...props} />
  ),
}

export default function SkillDetailDialog({ skill, onClose }: SkillDetailDialogProps) {
  const url = skill ? skillUrl(skill.slug) : ''
  // The same public SKILL.md an agent fetches, so the preview is exactly
  // what the agent reads.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-doc', url],
    queryFn: async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseSkillDoc(await res.text())
    },
    enabled: Boolean(skill),
  })

  return (
    <Dialog open={Boolean(skill)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <div className="border-b border-border px-6 pt-5 pb-4">
          <div className="flex items-start gap-3 pe-8">
            <IconBadge
              icon={IconBook2}
              variant="soft"
              className="h-10 w-10"
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
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-5/6 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Could not load this skill. Try again later.</p>
          ) : (
            <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {data?.body ?? ''}
            </Markdown>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
