import { IconRefresh, IconTerminal2 } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

import CliToolsGrid, { TOOLS } from '@/components/block/cli-tools/cli-tools-grid'
import PageHeader from '@/components/block/common/page-header'
import { Button } from '@/components/ui/button'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** /cli-tools: page header with a host rescan, then every supported tool. */
export default function CliToolsOverview() {
  const claudeCode = useQuery(queries.cliTools.claudeCode())
  // Only Claude Code is detected on the host; the rest are set up by hand.
  const connected = claudeCode.data?.installed ? 1 : 0

  return (
    <>
      <PageHeader
        icon={IconTerminal2}
        title="CLI tools"
        description="Point your coding tools at this gateway."
        actions={
          <Button
            variant="outline"
            disabled={claudeCode.isFetching}
            onClick={() => void claudeCode.refetch()}
          >
            <IconRefresh className={cn(claudeCode.isFetching && 'animate-spin')} />
            Rescan
          </Button>
        }
      />

      <section className="space-y-3">
        <div className="flex items-start gap-2">
          <IconTerminal2 className="text-muted-foreground mt-0.5 size-4" />
          <div>
            <p className="text-sm font-medium text-foreground">Tools</p>
            <p className="text-muted-foreground text-xs">
              {connected} of {TOOLS.length} connected
            </p>
          </div>
        </div>
        <CliToolsGrid />
      </section>
    </>
  )
}
