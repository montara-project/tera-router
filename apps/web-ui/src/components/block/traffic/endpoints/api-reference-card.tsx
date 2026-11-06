import { IconApi, IconCheck, IconChevronRight, IconCopy } from '@tabler/icons-react'
import { useState } from 'react'

import type { EndpointGroup, EndpointRoute } from '@/lib/api/models/endpoint'

import SectionCardPanel from '@/components/block/common/section-card-panel'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

const METHOD_TONE: Record<string, string> = {
  GET: 'bg-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  POST: 'bg-primary/10 text-primary ring-primary/30',
}

interface ApiReferenceCardProps {
  baseUrl: string
  groups: EndpointGroup[]
}

export default function ApiReferenceCard({ baseUrl, groups }: ApiReferenceCardProps) {
  // Untouched groups follow the default: the first one opens.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (group: EndpointGroup, index: number) => toggled[group.title] ?? index === 0
  const allOpen = groups.length > 0 && groups.every((g, i) => isOpen(g, i))
  const routeCount = groups.reduce((n, g) => n + g.routes.length, 0)

  const setAll = (open: boolean) =>
    setToggled(Object.fromEntries(groups.map((g) => [g.title, open])))

  return (
    <SectionCardPanel
      icon={IconApi}
      title={
        <>
          API reference
          <span className="font-normal text-muted-foreground">
            {routeCount} {routeCount === 1 ? 'route' : 'routes'}
          </span>
        </>
      }
      toolbar={
        <button
          type="button"
          disabled={groups.length === 0}
          onClick={() => setAll(!allOpen)}
          className="text-primary h-6 rounded-sm text-xs font-medium hover:underline disabled:opacity-60"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      }
    >
      <div className="divide-y divide-border">
        {groups.map((group, index) => {
          const open = isOpen(group, index)
          return (
            <Collapsible
              key={group.title}
              open={open}
              onOpenChange={(next) => setToggled((prev) => ({ ...prev, [group.title]: next }))}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium hover:bg-muted/40">
                <IconChevronRight
                  className={cn('size-4 text-muted-foreground', open && 'rotate-90')}
                  aria-hidden
                />
                {group.title}
                <span className="text-xs font-normal text-muted-foreground">
                  {group.routes.length}
                </span>
                {!group.auth && (
                  <span className="ms-auto text-xs font-normal text-muted-foreground">
                    No key required
                  </span>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y divide-border border-t border-border">
                  {group.routes.map((route) => (
                    <RouteRow
                      key={`${route.method} ${route.path}`}
                      route={route}
                      baseUrl={baseUrl}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </SectionCardPanel>
  )
}

function RouteRow({ route, baseUrl }: { route: EndpointRoute; baseUrl: string }) {
  const { copy, copied } = useCopyToClipboard()
  const url = `${baseUrl}${route.path}`

  return (
    <li className="flex items-center gap-3 py-2 ps-4 pe-4 sm:ps-10">
      <span
        className={cn(
          'w-12 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold ring-1 ring-inset',
          METHOD_TONE[route.method] ?? 'bg-muted text-muted-foreground ring-border'
        )}
      >
        {route.method}
      </span>
      <div className="min-w-0 flex-1">
        <code className="block font-mono text-xs break-all text-foreground">{route.path}</code>
        <p className="text-xs text-muted-foreground">{route.description}</p>
      </div>
      {route.provider && (
        <span className="shrink-0 rounded-sm border border-border bg-muted/40 px-1.5 text-[11px] text-muted-foreground">
          {route.provider}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={copied ? `${route.path} URL copied` : `Copy ${route.method} ${route.path} URL`}
        onClick={() => copy(url)}
      >
        {copied ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
      </Button>
    </li>
  )
}
