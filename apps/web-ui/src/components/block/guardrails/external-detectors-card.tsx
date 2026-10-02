import { IconLock } from '@tabler/icons-react'

import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

export default function ExternalDetectorsCard({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Card className="bg-background">
      <CardContent className="flex items-start gap-4 p-4 sm:p-5">
        <IconLock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Allow external detector engines</p>
          <p className="text-muted-foreground mt-1 text-sm">
            When off, every policy is forced back to its native engine — OpenAI Moderation,
            Microsoft Presidio, and embedding-based topic matching are disabled tenant-wide. Use
            this for GDPR / data-residency setups where prompt content must never leave the Tera
            Router process.
          </p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Allow external detector engines"
        />
      </CardContent>
    </Card>
  )
}
