import { IconChevronRight, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { Icons } from '@/components/block/cli-tools/icons'
import { Card } from '@/components/ui/card'
import { queries } from '@/lib/api/queries'

type CliTool = {
  id: string
  name: string
  description: string
  /** Brand tile background + glyph styling; letter glyphs stand in until a real logo exists. */
  tileClass: string
  glyph: React.ReactNode
}

const TOOLS: CliTool[] = [
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

export default function CliToolsGrid() {
  const claudeCode = useQuery(queries.cliTools.claudeCode())

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((tool) => {
        const installed = tool.id === 'claude-code' && claudeCode.data?.installed === true
        const card = (
          <Card className="hover:border-muted-foreground/40 h-full transition-colors">
            <div className="flex items-center gap-3.5 p-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${tool.tileClass}`}
              >
                {tool.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span
                    className="truncate text-sm font-semibold text-foreground"
                    title={tool.name}
                  >
                    {tool.name}
                  </span>
                  {installed ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <IconCircleCheck className="h-3 w-3" />
                      Installed
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px]">
                      <IconInfoCircle className="h-3 w-3" />
                      Not Installed
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{tool.description}</p>
              </div>
              <IconChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        )

        return tool.id === 'claude-code' ? (
          <Link
            key={tool.id}
            to="/cli-tools/claude-code"
            aria-label={tool.name}
            className="group rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {card}
          </Link>
        ) : (
          <button
            key={tool.id}
            type="button"
            aria-label={tool.name}
            className="group cursor-pointer text-left"
          >
            {card}
          </button>
        )
      })}
    </div>
  )
}
