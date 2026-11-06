import { IconCheck, IconCopy, IconWorldShare, type IconKey } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { Icons } from '../../common/icons'

export default function TunnelSection() {
  const { data: cloudflare } = useQuery(queries.tunnels.cloudflare())
  const enableCloudflare = useMutation(queries.tunnels.enableCloudflare())
  const disableCloudflare = useMutation(queries.tunnels.disableCloudflare())

  const { data: tailscale } = useQuery(queries.tunnels.tailscale())
  const enableTailscale = useMutation(queries.tunnels.enableTailscale())
  const disableTailscale = useMutation(queries.tunnels.disableTailscale())

  const cloudflarePending = enableCloudflare.isPending || disableCloudflare.isPending
  const tailscalePending = enableTailscale.isPending || disableTailscale.isPending

  let tailscaleDescription: React.ReactNode = 'Private HTTPS on your tailnet via tailscale serve'
  if (tailscale?.installed === false) {
    tailscaleDescription = 'tailscale is not installed on the server host'
  } else if (tailscale && !tailscale.logged_in) {
    tailscaleDescription = (
      <>
        Not on a tailnet: run{' '}
        <code className="font-mono text-[11px] text-foreground">tailscale up</code> on the server
        host
      </>
    )
  }

  return (
    <SectionCardPanel
      title="Tunnels"
      description="Optional access from outside this machine"
      icon={IconWorldShare}
    >
      <div className="divide-y divide-border">
        <TunnelAppItem
          title="Cloudflare Tunnel"
          description={
            cloudflare?.installed === false
              ? 'cloudflared is not installed on the server host'
              : 'Quick tunnel — no account needed'
          }
          buttonText={toggleLabel(
            cloudflare?.running,
            enableCloudflare.isPending,
            disableCloudflare.isPending
          )}
          icon={Icons.cloudflare}
          disabled={!cloudflare?.installed || cloudflarePending}
          onClick={() =>
            void toggleTunnel(
              cloudflare?.running ? disableCloudflare : enableCloudflare,
              'Tunnel',
              cloudflare?.running
            )
          }
        >
          {cloudflare?.url && <TunnelUrl label="Cloudflare Tunnel URL" url={cloudflare.url} />}
        </TunnelAppItem>
        <TunnelAppItem
          title="Tailscale"
          description={tailscaleDescription}
          buttonText={toggleLabel(
            tailscale?.running,
            enableTailscale.isPending,
            disableTailscale.isPending
          )}
          icon={Icons.tailscale}
          disabled={!tailscale?.installed || !tailscale.logged_in || tailscalePending}
          onClick={() =>
            void toggleTunnel(
              tailscale?.running ? disableTailscale : enableTailscale,
              'Tailscale',
              tailscale?.running
            )
          }
        >
          {tailscale?.url && <TunnelUrl label="Tailscale URL" url={tailscale.url} />}
        </TunnelAppItem>
      </div>
    </SectionCardPanel>
  )
}

/** Enable/Disable button text, with progress while a toggle is in flight. */
function toggleLabel(running: boolean | undefined, starting: boolean, stopping: boolean) {
  if (starting) return 'Starting…'
  if (stopping) return 'Stopping…'
  return running ? 'Disable' : 'Enable'
}

async function toggleTunnel(
  mutation: { mutateAsync: () => Promise<{ message?: string }> },
  name: string,
  running: boolean | undefined
) {
  try {
    const res = await mutation.mutateAsync()
    toast.success(res.message ?? (running ? `${name} disabled` : `${name} enabled`))
  } catch (error) {
    toastAxiosError(error)
  }
}

/** Read-only tunnel URL with a copy button. */
function TunnelUrl({ label, url }: { label: string; url: string }) {
  const { copy, copied } = useCopyToClipboard()

  return (
    <InputWrapper variant="xl">
      <Input
        type="text"
        readOnly
        aria-label={label}
        value={url}
        className="font-mono text-sm [&[readonly]]:cursor-text [&[readonly]]:bg-transparent"
      />
      <Button onClick={() => copy(url)} variant="secondary" disabled={copied} className="-me-3.5">
        {copied ? (
          <IconCheck className="size-4 text-green-600" />
        ) : (
          <>
            <IconCopy strokeWidth={1.5} className="size-4 text-white" />
            Copy
          </>
        )}
      </Button>
    </InputWrapper>
  )
}

interface TunnelAppItemProps {
  title: string
  description: React.ReactNode
  buttonText: string
  icon: typeof IconKey | React.ComponentType<React.SVGProps<SVGSVGElement>>
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
}

function TunnelAppItem({
  title,
  description,
  buttonText,
  icon: Icon,
  disabled,
  onClick,
  children,
}: TunnelAppItemProps) {
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10"
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="outline" disabled={disabled} onClick={onClick}>
          <span>{buttonText}</span>
        </Button>
      </div>
      {children}
    </div>
  )
}
