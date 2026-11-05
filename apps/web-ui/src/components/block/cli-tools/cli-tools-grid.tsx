import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type CliTool = {
  id: string
  name: string
  description: string
}

/** Every supported tool, alphabetical. Logos live in public/static/images/cli-tools/<id>.png. */
export const TOOLS: CliTool[] = [
  { id: 'claude-code', name: 'Claude Code', description: "Anthropic's CLI coding agent" },
  { id: 'cline-roo', name: 'Cline / Roo', description: 'VS Code AI coding assistant' },
  { id: 'codex-cli', name: 'Codex CLI', description: 'OpenAI Codex CLI' },
  { id: 'deepseek-tui', name: 'DeepSeek TUI', description: 'DeepSeek TUI' },
  { id: 'factory-droid', name: 'Factory Droid', description: 'Factory Droid CLI' },
  { id: 'github-copilot', name: 'GitHub Copilot (VS Code)', description: 'GitHub Copilot Chat' },
  { id: 'hermes-agent', name: 'Hermes Agent', description: 'Hermes Agent CLI' },
  { id: 'jcode', name: 'jcode', description: 'jcode coding agent' },
  { id: 'kilo-code', name: 'Kilo Code', description: 'Kilo Code AI assistant' },
  { id: 'openclaw', name: 'OpenClaw', description: 'OpenClaw agent framework' },
  { id: 'opencode', name: 'OpenCode', description: 'OpenCode multi-model agent' },
]

/** The tool's app icon on a white tile. */
export function ToolLogo({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-white p-px',
        className
      )}
    >
      <img
        src={`/static/images/cli-tools/${id}.png`}
        alt=""
        className="size-full rounded-[3px] object-contain"
      />
    </span>
  )
}

export function useInstalledTools() {
  const { data } = useQuery(queries.cliTools.list())
  return new Map((data ?? []).map((tool) => [tool.id, tool]))
}

export default function CliToolsGrid() {
  const installed = useInstalledTools()

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TOOLS.map((tool) => {
        const status = installed.get(tool.id)
        const on = status?.installed === true

        return (
          <li key={tool.id}>
            <Link
              // Claude Code has its own apply flow; the rest get copy-paste setup.
              to={tool.id === 'claude-code' ? '/cli-tools/claude-code' : '/cli-tools/$toolId'}
              params={{ toolId: tool.id }}
              className="flex items-center gap-3.5 rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-muted-foreground/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ToolLogo id={tool.id} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {tool.name}
                  </span>
                  {status && (
                    <span
                      title={on ? status.path : undefined}
                      className={cn(
                        'inline-flex h-5 shrink-0 items-center rounded-sm border px-1.5 text-[11px] font-medium',
                        on
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-border bg-muted/40 text-muted-foreground'
                      )}
                    >
                      {on ? 'Installed' : 'Not installed'}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{tool.description}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
