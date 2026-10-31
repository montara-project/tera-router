import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { Icons } from '@/components/block/cli-tools/icons'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type CliTool = {
  id: string
  name: string
  description: string
  /** Brand tile background + glyph styling; letter glyphs stand in until a real logo exists. */
  tileClass: string
  glyph: React.ReactNode
}

export const TOOLS: CliTool[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's CLI coding agent",
    tileClass: 'bg-[#d97757] text-white',
    glyph: <Icons.claude className="size-6" aria-hidden />,
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI',
    tileClass: 'bg-neutral-950 text-neutral-100 border border-border',
    glyph: <Icons.codex className="size-6" aria-hidden />,
  },
  {
    id: 'cline-roo',
    name: 'Cline / Roo',
    description: 'VS Code AI coding assistant',
    tileClass: 'bg-[#2b2660] text-violet-300',
    glyph: 'C',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'GitHub Copilot Chat',
    tileClass: 'bg-[#1f3a5f] text-sky-200',
    glyph: <Icons.githubCopilot className="size-6" aria-hidden />,
  },
  {
    id: 'factory-droid',
    name: 'Factory Droid',
    description: 'Factory Droid CLI',
    tileClass: 'bg-card text-foreground border border-border',
    glyph: <Icons.fdroid className="size-6" aria-hidden />,
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'OpenClaw agent framework',
    tileClass: 'bg-card text-foreground border border-border',
    glyph: <Icons.openclaw className="size-6" aria-hidden />,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode multi-model agent',
    tileClass: 'bg-neutral-950 text-neutral-100 border border-border',
    glyph: <Icons.opencode className="size-6" aria-hidden />,
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    description: 'Kilo Code AI assistant',
    tileClass: 'bg-[#f5d90a] text-neutral-900',
    glyph: <Icons.kiloCode className="size-6" aria-hidden />,
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    description: 'Hermes Agent CLI',
    tileClass: 'bg-card text-amber-400 border border-amber-500/40',
    glyph: <Icons.hermes className="size-6" aria-hidden />,
  },
  {
    id: 'deepseek-tui',
    name: 'DeepSeek TUI',
    description: 'DeepSeek TUI',
    tileClass: 'bg-card text-foreground border border-border',
    glyph: <Icons.deepseek className="size-6" aria-hidden />,
  },
  {
    id: 'jcode',
    name: 'jcode',
    description: 'jcode coding agent',
    tileClass: 'bg-[#6ee7b7] text-emerald-950',
    glyph: 'j',
  },
]

type ToolState = 'installed' | 'missing' | 'manual'

const STATE_BADGES: Record<ToolState, { label: string; className: string }> = {
  installed: {
    label: 'Installed',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  missing: { label: 'Not installed', className: 'text-muted-foreground border-border bg-muted/40' },
  manual: { label: 'Copy config', className: 'text-muted-foreground border-border bg-muted/40' },
}

/** Claude Code is detected on the host; every other tool is configured by hand. */
function toolState(toolId: string, claudeCodeInstalled: boolean): ToolState {
  if (toolId !== 'claude-code') return 'manual'
  return claudeCodeInstalled ? 'installed' : 'missing'
}

export default function CliToolsGrid() {
  const claudeCode = useQuery(queries.cliTools.claudeCode())

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map((tool) => {
        const badge = STATE_BADGES[toolState(tool.id, claudeCode.data?.installed === true)]

        return (
          <Link
            key={tool.id}
            // Claude Code has its own apply flow; the rest get copy-paste setup.
            to={tool.id === 'claude-code' ? '/cli-tools/claude-code' : '/cli-tools/$toolId'}
            params={{ toolId: tool.id }}
            aria-label={tool.name}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-muted-foreground/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold [&_svg]:size-5 ${tool.tileClass}`}
            >
              {tool.glyph}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={tool.name}>
                {tool.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">{tool.description}</p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                badge.className
              )}
            >
              {badge.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
