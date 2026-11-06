import { IconRefresh, IconTerminal2 } from '@tabler/icons-react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'

import CliToolsGrid, { useInstalledTools } from '@/components/block/cli-tools/cli-tools-grid'
import PageHeader from '@/components/block/common/page-header'
import { Button } from '@/components/ui/button'
import { CLI_TOOL_QUERY_KEY } from '@/lib/api/queries/cli-tool'
import { CLI_TOOLS } from '@/lib/constants/cli-tools'
import { cn } from '@/lib/utils'

/** /cli-tools: page header with a host rescan, then every supported tool. */
export default function CliToolsOverview() {
  const queryClient = useQueryClient()
  const installed = useInstalledTools()
  const scanning = useIsFetching({ queryKey: [CLI_TOOL_QUERY_KEY] }) > 0
  const count = [...installed.values()].filter((tool) => tool.installed).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconTerminal2}
        title="CLI tools"
        description="Point your coding tools at this gateway."
        actions={
          <Button
            variant="outline"
            disabled={scanning}
            onClick={() => void queryClient.invalidateQueries({ queryKey: [CLI_TOOL_QUERY_KEY] })}
          >
            <IconRefresh className={cn(scanning && 'motion-safe:animate-spin')} />
            Rescan
          </Button>
        }
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <IconTerminal2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">Tools</h2>
            <p className="text-xs text-muted-foreground">
              {count} of {CLI_TOOLS.length} installed on this host
            </p>
          </div>
        </div>
        <CliToolsGrid />
      </section>
    </div>
  )
}
