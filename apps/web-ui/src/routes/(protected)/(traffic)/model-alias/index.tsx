import { IconChevronRight, IconPlus, IconReplace, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import SelectInput from '@/components/block/common/select-input'
import AliasDetailDialog from '@/components/block/traffic/model-alias/alias-detail-dialog'
import AliasFormDialog from '@/components/block/traffic/model-alias/alias-form-dialog'
import AliasRow from '@/components/block/traffic/model-alias/alias-row'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(traffic)/model-alias/')({
  component: ModelAliasRoute,
})

const ALIAS_STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function ModelAliasRoute() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [viewing, setViewing] = useState<Models.ModelAlias | null>(null)
  const [editing, setEditing] = useState<Models.ModelAlias | null>(null)

  const { data, isLoading, isError, error } = useQuery(queries.aliases.list())

  useEffect(() => {
    if (isError) {
      toast.error(error?.message || 'Failed to load aliases')
    }
  }, [isError, error])

  const all = useMemo(() => data?.data ?? [], [data])
  const aliases = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all.filter((alias) => {
      if (q && !alias.name.toLowerCase().includes(q) && !alias.group?.toLowerCase().includes(q)) {
        return false
      }
      if (status === 'active' && !alias.active) {
        return false
      }
      if (status === 'inactive' && alias.active) {
        return false
      }
      return true
    })
  }, [all, search, status])

  const filtering = search.trim() !== '' || status !== 'all'

  // Named groups alphabetically, Ungrouped ('') last. Stays flat until at
  // least one alias carries a group.
  const groups = useMemo(() => {
    const byGroup = new Map<string, Models.ModelAlias[]>()
    for (const alias of aliases) {
      const group = alias.group?.trim() ?? ''
      byGroup.set(group, [...(byGroup.get(group) ?? []), alias])
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      if (a === '' || b === '') return a === '' ? 1 : -1
      return a.localeCompare(b)
    })
  }, [aliases])

  const renderAliases = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )
    }

    if (aliases.length === 0) {
      return (
        <EmptyState
          icon={IconReplace}
          title={filtering ? 'No aliases match your filters' : 'No model aliases yet'}
          description={
            filtering
              ? 'Try a shorter name or clear the filters to see every alias.'
              : 'Create an alias to give clients a stable model name backed by an ordered pool of provider targets.'
          }
          action={
            filtering ? null : (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <IconPlus /> Create Alias
              </Button>
            )
          }
        />
      )
    }

    const renderRows = (rows: Models.ModelAlias[]) => (
      <div className="divide-border border-border divide-y rounded-xl border">
        {rows.map((alias) => (
          <AliasRow key={alias.id} alias={alias} onShow={setViewing} onEdit={setEditing} />
        ))}
      </div>
    )

    if (groups.length === 1 && groups[0][0] === '') {
      return renderRows(aliases)
    }

    return (
      <div className="space-y-3">
        {groups.map(([group, rows]) => (
          <details key={group || '__ungrouped'} open className="group/alias space-y-2">
            <summary className="hover:text-foreground text-muted-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
              <IconChevronRight className="size-4 transition-transform group-open/alias:rotate-90" />
              <span className="text-foreground">{group || 'Ungrouped'}</span>
              <span className="tabular-nums">({rows.length})</span>
            </summary>
            {renderRows(rows)}
          </details>
        ))}
      </div>
    )
  }

  return (
    <SectionCard
      title="Model Alias"
      description="One alias name mapped to an ordered pool of provider/model targets. Keys and plans reference the alias, so provider changes never require re-assignment."
      toolbar={
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus />
          <span>Create Alias</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <InputWrapper variant="lg" className="rounded-lg">
            <IconSearch />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search aliases..."
              aria-label="Search aliases by name"
            />
          </InputWrapper>

          <SelectInput
            className="w-50 h-10"
            placeholder="Select status"
            options={ALIAS_STATUS_OPTIONS}
            defaultValue="all"
            onSelect={setStatus}
          />
        </div>

        {renderAliases()}
      </div>

      <AliasDetailDialog
        alias={viewing}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null)
          }
        }}
        onEdit={(alias) => {
          setViewing(null)
          setEditing(alias)
        }}
      />

      <AliasFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AliasFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        alias={editing}
      />
    </SectionCard>
  )
}
