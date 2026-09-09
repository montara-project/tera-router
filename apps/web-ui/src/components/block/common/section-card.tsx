'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title: string
  description?: string
  toolbar?: React.ReactNode
  children: React.ReactNode
}

export default function SectionCard({ title, description, toolbar, children }: SectionCardProps) {
  return (
    <div className="bg-sidebar border border-sidebar-accent p-2 rounded-2xl">
      <Card className="w-full rounded-lg bg-background">
        <CardHeader className={cn('flex items-center', description ? 'h-22' : 'h-15 ')}>
          <CardHeading>
            <CardTitle className="text-xl leading-relaxed tracking-normal">{title}</CardTitle>
            <CardDescription
              className={cn('text-sm text-muted-foreground', !description && 'sr-only')}
            >
              {description}
            </CardDescription>
          </CardHeading>

          {toolbar && <CardToolbar>{toolbar}</CardToolbar>}
        </CardHeader>
        <CardContent className="p-4">{children}</CardContent>
      </Card>
    </div>
  )
}
