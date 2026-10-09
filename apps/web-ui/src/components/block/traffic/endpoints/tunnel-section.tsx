import { IconCloud, IconKey } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckIcon, CopyIcon } from 'lucide-react'
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
  const { copy, copied } = useCopyToClipboard()
  const { data: cloudflare } = useQuery(queries.tunnels.cloudflare())
  const enableMutation = useMutation(queries.tunnels.enableCloudflare())
  const disableMutation = useMutation(queries.tunnels.disableCloudflare())

  const running = cloudflare?.running ?? false
  const pending = enableMutation.isPending || disableMutation.isPending

  const handleToggle = async () => {
    try {
      const res = await (running ? disableMutation : enableMutation).mutateAsync()
      toast.success(res.message ?? (running ? 'Tunnel disabled' : 'Tunnel enabled'))
    } catch (error) {
      toastAxiosError(error)
    }
  }

  let cloudflareButton = running ? 'Disable' : 'Enable'
  if (enableMutation.isPending) cloudflareButton = 'Starting…'
  if (disableMutation.isPending) cloudflareButton = 'Stopping…'

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconCloud}
            variant="soft"
            className="h-10 w-10"
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
            buttonText={cloudflareButton}
            icon={Icons.cloudflare}
            tone="warning"
            disabled={!cloudflare?.installed || pending}
            onClick={handleToggle}
          >
            {cloudflare?.url && (
              <InputWrapper variant="xl">
                <Input
                  type="text"
                  readOnly
                  aria-label="Cloudflare Tunnel URL"
                  value={cloudflare.url}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => copy(cloudflare.url)}
                  variant="secondary"
                  disabled={copied}
                  className="-me-3.5"
                >
                  {copied ? (
                    <CheckIcon className="size-4 text-green-600" />
                  ) : (
                    <>
                      <CopyIcon strokeWidth={1.5} className="size-4 text-white" />
                      Copy
                    </>
                  )}
                </Button>
              </InputWrapper>
            )}
          </TunnelAppItem>
          <TunnelAppItem
            title="Tailscale"
            description="Private network with HTTPS"
            buttonText="Coming Soon"
            icon={Icons.tailscale}
            tone="info"
            disabled
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface TunnelAppItemProps {
  title: string
  description: string
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
      <div className="flex items-center justify-between gap-4">
        <ConnectApp icon={Icon} title={title} description={description} tone={tone} />
        <Button disabled={disabled} onClick={onClick}>
          <span>{buttonText}</span>
        </Button>
      </div>
      {children}
    </div>
  )
}
