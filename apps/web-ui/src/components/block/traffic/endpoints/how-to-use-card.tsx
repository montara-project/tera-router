import { IconListNumbers } from '@tabler/icons-react'

import IconBadge from '@/components/block/common/icon-badge'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'

interface HowToStep {
  title: string
  description: string
  optional?: boolean
}

const STEPS: HowToStep[] = [
  {
    title: 'Add a provider',
    description: 'Connect an upstream provider from the Providers page.',
  },
  {
    title: 'Open the provider detail',
    description: 'Click a provider to manage its accounts, routing, and models.',
  },
  {
    title: 'Add an API key',
    description: 'Store the upstream credential so the router can call the provider.',
  },
  {
    title: 'Browse the models',
    description: "The provider's synced models live in the Models tab of its detail page.",
    optional: true,
  },
  {
    title: 'Add a model alias',
    description:
      'The alias is the model name exposed to the public. Without at least one alias the router has no model to serve and cannot be used.',
  },
]

export default function HowToUseCard() {
  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <div className="flex items-center gap-3.5">
          <IconBadge
            icon={IconListNumbers}
            variant="soft"
            className="h-10 w-10"
            iconClassName="h-5 w-5"
          />
          <CardHeading>
            <CardTitle>How to use this router</CardTitle>
            <CardDescription>
              From a fresh install to a working endpoint, in five steps.
            </CardDescription>
          </CardHeading>
        </div>
      </CardHeader>
      <CardContent>
        <ol>
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
              {index < STEPS.length - 1 ? (
                <span aria-hidden className="absolute left-[13px] top-8 bottom-1 w-px bg-border" />
              ) : null}
              <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/60">
                {index + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {step.title}
                  {step.optional ? (
                    <Badge variant="secondary" size="sm">
                      Optional
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
