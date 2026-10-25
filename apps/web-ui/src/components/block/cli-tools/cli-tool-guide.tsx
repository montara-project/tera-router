import { IconAlertTriangle, IconArrowLeft, IconExternalLink } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { TOOLS } from '@/components/block/cli-tools/cli-tools-grid'
import CopyableButton from '@/components/block/common/copyable-button'
import SectionCard from '@/components/block/common/section-card'
import { Card } from '@/components/ui/card'
import { env } from '@/config/env'
import { CLI_TOOL_GUIDES, KEY_PLACEHOLDER, MODEL_PLACEHOLDER } from '@/lib/constants/cli-tools'

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'

export default function CliToolGuideDetail({ toolId }: { toolId: string }) {
  const tool = TOOLS.find((item) => item.id === toolId)
  const guide = CLI_TOOL_GUIDES[toolId]

  if (!tool || !guide) {
    return (
      <SectionCard title="Unknown CLI tool" description={`No setup guide for "${toolId}".`}>
        <Link to="/cli-tools" className={BACK_LINK_CLASS}>
          <IconArrowLeft className="h-4 w-4" />
          Back to CLI Tools
        </Link>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/cli-tools" className={BACK_LINK_CLASS}>
        <IconArrowLeft className="h-4 w-4" />
        Back to CLI Tools
      </Link>

      <div className="flex items-center gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-bold ${tool.tileClass}`}
        >
          {tool.glyph}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{tool.name}</h1>
          <p className="text-muted-foreground text-sm">{tool.description}</p>
        </div>
      </div>

      {guide.generic && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-sm dark:bg-amber-950/30"
        >
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            {tool.name} has no documented config format we could verify, so this is the generic
            OpenAI-compatible setup. Check the tool's own docs for where it reads these values.
          </p>
        </div>
      )}

      <Card className="space-y-5 p-5">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {guide.snippets.map((snippet) => {
          const content = snippet.content(env.VITE_API_URL)
          return (
            <div key={snippet.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium">
                  {snippet.label}
                  {snippet.file && (
                    <span className="text-muted-foreground ml-2 font-mono">{snippet.file}</span>
                  )}
                </p>
                <CopyableButton value={content} sorted={false} size="sm" />
              </div>
              <pre className="bg-muted/40 overflow-x-auto rounded-lg border border-border p-3 font-mono text-xs leading-relaxed">
                {content}
              </pre>
            </div>
          )
        })}

        <p className="text-muted-foreground text-xs">
          Replace <code className="font-mono">{KEY_PLACEHOLDER}</code> with a key from{' '}
          <Link to="/keys" className="underline">
            API Keys
          </Link>{' '}
          and <code className="font-mono">{MODEL_PLACEHOLDER}</code> with a model, alias, or chain
          name routed by this instance.
        </p>

        {guide.docsUrl && (
          <a
            href={guide.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-500"
          >
            {tool.name} config docs
            <IconExternalLink className="h-3 w-3" />
          </a>
        )}
      </Card>
    </div>
  )
}
