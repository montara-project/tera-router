import { IconKey } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import ConnectApp from './connect-app'

export default function TunnelSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tunnels</CardTitle>
        <CardDescription>Optional network access for apps outside this machine.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TunnelAppItem
          title="Cloudflare Tunnel"
          description="Quick tunnel — no account needed"
          buttonText="Enable"
          icon={Icons.cloudflare}
          tone="warning"
        />
        <Separator />
        <TunnelAppItem
          title="Tailscale"
          description="Private network with HTTPS"
          buttonText="Coming Soon"
          icon={Icons.tailscale}
          tone="info"
        />
      </CardContent>
    </Card>
  )
}

import type { ConnectToneVariant } from './connect-app'

import { Icons } from '../../common/icons'

interface TunnelAppItemProps {
  title: string
  description: string
  buttonText: string
  icon: typeof IconKey | React.ComponentType<React.SVGProps<SVGSVGElement>>
  iconBtn?: typeof IconKey
  tone: ConnectToneVariant
}

function TunnelAppItem({
  title,
  description,
  buttonText,
  icon: Icon,
  iconBtn: IconBtn,
  tone,
}: TunnelAppItemProps) {
  return (
    <div className="w-full flex justify-between items-center">
      <ConnectApp icon={Icon} title={title} description={description} tone={tone} />
      <Button>
        <span>{buttonText}</span>
        {IconBtn && <IconBtn size={16} />}
      </Button>
    </div>
  )
}
