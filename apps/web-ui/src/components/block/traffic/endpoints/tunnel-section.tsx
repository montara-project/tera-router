import { IconCheck, IconCloud, IconCopy, IconKey } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import IconBadge from '@/components/block/common/icon-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input, InputWrapper } from '@/components/ui/input'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { Icons } from '../../common/icons'
import ConnectApp, { type ConnectToneVariant } from './connect-app'

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
    <Card className="bg-background">
      <CardHeader className="py-4">
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconCloud}
            variant="soft"
            className="h-10 w-10 shrink-0"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>Tunnels</CardTitle>
            <CardDescription>
              Optional network access for apps outside this machine.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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
            tone="warning"
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
            tone="info"
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
      </CardContent>
    </Card>
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
  tone: ConnectToneVariant
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
  tone,
  disabled,
  onClick,
  children,
}: TunnelAppItemProps) {
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ConnectApp icon={Icon} title={title} description={description} tone={tone} />
        <Button disabled={disabled} onClick={onClick}>
          <span>{buttonText}</span>
        </Button>
      </div>
      {children}
    </div>
  )
}
