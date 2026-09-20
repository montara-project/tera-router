import { IconArrowUpCircle, IconRefresh } from '@tabler/icons-react'

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

interface SystemTabProps {
  version: string
}

export default function SystemTab({ version }: SystemTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <IconBadge
              icon={IconArrowUpCircle}
              variant="soft"
              className="h-10 w-10"
              iconClassName="h-5 w-5"
            />
            <CardHeading>
              <CardTitle>Updates</CardTitle>
              <CardDescription>
                Check for new KeiRouter releases and read the latest changelog.
              </CardDescription>
            </CardHeading>
          </div>
          <Button type="button" variant="outline" className="shrink-0">
            <IconRefresh className="h-4 w-4" />
            Check now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
          <div className="flex items-center gap-10">
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Current
              </p>
              <p className="text-foreground mt-0.5 font-mono text-lg">v{version}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                Latest
              </p>
              <p className="text-foreground mt-0.5 font-mono text-lg">v{version}</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-950 px-2.5 py-1.5 text-xs font-semibold text-emerald-400">
            <IconArrowUpCircle className="h-3.5 w-3.5" />
            Up to date
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
