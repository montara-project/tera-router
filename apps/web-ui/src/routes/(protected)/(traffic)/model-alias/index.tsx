import { IconPlus, IconReplace, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import AliasCard from '@/components/block/traffic/model-alias/alias-card'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/model-alias/')({
  component: ModelAliasRoute,
})

function blankAlias(): Models.ModelAlias {
  return {
    id: '',
    name: '',
    context_window: 0,
    active: true,
    targets: [{ id: '', alias_id: '', position: 1, provider: '', model: '', active: true }],
    created_at: '',
    updated_at: '',
  }
}

function ModelAliasRoute() {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery(queries.aliases.list())
  const aliases = useMemo(() => {
    const rows = data?.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((a) => a.name.toLowerCase().includes(q))
  }, [data, search])

  return (
    <SectionCard
      title="Model Alias"
      description="One alias name mapped to an ordered pool of provider/model targets. Keys and plans reference the alias, so provider changes never require re-assignment."
      toolbar={
        <Button
          size="sm"
          className="bg-emerald-600 text-white hover:bg-emerald-500/90 dark:bg-emerald-600 dark:hover:bg-emerald-500/90"
          onClick={() => setCreating(true)}
        >
          <IconPlus /> New alias
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative w-full max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search aliases by name..."
            className="h-10 pl-9"
          />
        </div>

        {creating ? (
          <AliasCard alias={blankAlias()} isNew onClose={() => setCreating(false)} />
        ) : null}

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : aliases.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconReplace />
              </EmptyMedia>
              <EmptyTitle>
                {search ? 'No aliases match your search' : 'No model aliases yet'}
              </EmptyTitle>
              <EmptyDescription>
                {search
                  ? 'Try a shorter name or clear the search to see every alias.'
                  : 'Create an alias to give clients a stable model name backed by an ordered pool of provider targets.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          aliases.map((alias) => <AliasCard key={alias.id} alias={alias} />)
        )}
      </div>
    </SectionCard>
  )
}
