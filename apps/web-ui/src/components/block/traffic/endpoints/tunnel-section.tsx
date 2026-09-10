import { IconKey } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { Icons } from '../../common/icons'
import ConnectApp, { type ConnectToneVariant } from './connect-app'

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
          disabled
        />
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
  iconBtn?: typeof IconKey
  disabled?: boolean
}

function TunnelAppItem({
  title,
  description,
  buttonText,
  icon: Icon,
  iconBtn: IconBtn,
  tone,
  disabled,
}: TunnelAppItemProps) {
  return (
    <div className="w-full flex justify-between items-center">
      <ConnectApp icon={Icon} title={title} description={description} tone={tone} />
      <Button disabled={disabled}>
        <span>{buttonText}</span>
        {IconBtn && <IconBtn size={16} />}
      </Button>
    </div>
  )
}
