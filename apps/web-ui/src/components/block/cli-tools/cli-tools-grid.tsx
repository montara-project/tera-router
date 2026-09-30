import { IconChevronRight, IconInfoCircle } from '@tabler/icons-react'

import { Card } from '@/components/ui/card'

type CliTool = {
  id: string
  name: string
  description: string
  /** Brand tile background + glyph styling; swap for real logos when available. */
  tileClass: string
  glyph: string
}

const TOOLS: CliTool[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: "Anthropic's CLI coding agent",
    tileClass: 'bg-[#d97757] text-white',
    glyph: 'C',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    description: 'OpenAI Codex CLI',
    tileClass: 'bg-neutral-950 text-neutral-100 border border-border',
    glyph: 'C',
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
    glyph: 'G',
  },
  {
    id: 'factory-droid',
    name: 'Factory Droid',
    description: 'Factory Droid CLI',
    tileClass: 'bg-card text-foreground border border-border',
    glyph: 'F',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'OpenClaw agent framework',
    tileClass: 'bg-[#8a2a1d] text-orange-200',
    glyph: 'O',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode multi-model agent',
    tileClass: 'bg-neutral-950 text-neutral-100 border border-border',
    glyph: 'O',
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    description: 'Kilo Code AI assistant',
    tileClass: 'bg-[#f5d90a] text-neutral-900',
    glyph: 'K',
  },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    description: 'Hermes Agent CLI',
    tileClass: 'bg-card text-amber-400 border border-amber-500/40',
    glyph: 'H',
  },
  {
    id: 'deepseek-tui',
    name: 'DeepSeek TUI',
    description: 'DeepSeek TUI',
    tileClass: 'bg-neutral-950 text-neutral-100 border border-border',
    glyph: 'D',
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
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          aria-label={`${tool.name}`}
          className="group cursor-pointer text-left"
        >
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
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px]">
                    <IconInfoCircle className="h-3 w-3" />
                    Not Installed
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{tool.description}</p>
              </div>
              <IconChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </button>
      ))}
    </div>
  )
}
