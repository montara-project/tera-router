import { IconCheck, IconCopy, IconLink, IconServer, IconWorld } from '@tabler/icons-react'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

function isLocalHost(origin: string) {
  try {
    return LOCAL_HOSTS.includes(new URL(origin).hostname)
  } catch {
    return false
  }
}

interface ConnectSectionProps {
  /** origin the router is reached on, from GET /v1/endpoints */
  baseUrl: string
}

export default function ConnectSection({ baseUrl }: ConnectSectionProps) {
  const url = `${baseUrl}/v1`
  const local = isLocalHost(baseUrl)
  const ScopeIcon = local ? IconServer : IconWorld
  const { copy, copied } = useCopyToClipboard()

  return (
    <DashboardPanel title="Base URL" icon={IconLink}>
      <div className="space-y-1.5 p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScopeIcon className="size-4" stroke={1.5} aria-hidden />
          {local ? 'Local' : 'Remote'}
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 py-1 ps-3 pe-1">
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground" title={url}>
            {url}
          </code>
          <Button onClick={() => copy(url)} aria-label="Copy base URL">
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        Authenticate with{' '}
        <code className="font-mono text-foreground">Authorization: Bearer &lt;key&gt;</code> or{' '}
        <code className="font-mono text-foreground">x-api-key</code>.
      </p>
    </DashboardPanel>
  )
}
