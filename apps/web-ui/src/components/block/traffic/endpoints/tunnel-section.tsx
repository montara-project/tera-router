import { IconCloud, IconKey } from '@tabler/icons-react'

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

import { Icons } from '../../common/icons'
import ConnectApp, { type ConnectToneVariant } from './connect-app'

export default function TunnelSection() {
  return (
    <Card>
      <CardHeader>
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
            description="Quick tunnel — no account needed"
            buttonText="Enable"
            icon={Icons.cloudflare}
            tone="warning"
          />
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
}

function TunnelAppItem({
  title,
  description,
  buttonText,
  icon: Icon,
  tone,
  disabled,
}: TunnelAppItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <ConnectApp icon={Icon} title={title} description={description} tone={tone} />
      <Button disabled={disabled}>
        <span>{buttonText}</span>
      </Button>
    </div>
  )
}
