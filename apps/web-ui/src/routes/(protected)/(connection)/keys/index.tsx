import { IconKey, IconPlus } from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import type { KeysFilters } from '@/components/block/keys/filter-keys'
import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import { DEFAULT_KEYS_FILTERS } from '@/components/block/keys/filter-keys'
import { AddKeyForm } from '@/components/block/keys/form'
import KeySecretDialog from '@/components/block/keys/key-secret-dialog'
import KeysTable from '@/components/block/keys/keys-table'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { keyQueries } from '@/lib/api/queries/key'

export const Route = createFileRoute('/(protected)/(connection)/keys/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [filters, setFilters] = useState<KeysFilters>(DEFAULT_KEYS_FILTERS)
  const [openDialog, setOpenDialog] = useState(false)
  // The one-time secret dialog payload; set from the create response, which is
  // the only moment the API returns the plaintext key.
  const [createdKey, setCreatedKey] = useState<Models.ApiKey | null>(null)

  // The server searches, filters, sorts and pages; this reads one page.
  const { offset, limit, pageIndex } = usePaginationQuery()
  const search = useDebounce({ value: filters.search.trim(), delay: 300 })
  const { data, isLoading } = useQuery({
    ...keyQueries.list({
      offset,
      limit,
      search: search || undefined,
      // "restricted" is not a status the server reports; it matches no key.
      status:
        filters.status === 'all' || filters.status === 'restricted' ? undefined : filters.status,
      sort: filters.sort,
    }),
    placeholderData: keepPreviousData,
  })
  const meta = data?.metadata
  const counts = {
    all: Number(meta?.total_all ?? 0),
    active: Number(meta?.total_active ?? 0),
    disabled: Number(meta?.total_disabled ?? 0),
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconKey}
        title="API keys"
        description="Keys your tools and teammates use to call Tera Router."
        actions={
          <Button onClick={() => setOpenDialog(true)}>
            <IconPlus />
            <span>New key</span>
          </Button>
        }
      />

      <KeysTable
        counts={counts}
        rows={data?.data ?? []}
        total={meta?.total ?? 0}
        pageIndex={pageIndex}
        pageSize={limit}
        loading={isLoading}
        filters={filters}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onCreate={() => setOpenDialog(true)}
      />

      <AddKeyForm onCreated={setCreatedKey} open={openDialog} onOpenChange={setOpenDialog} />
      <KeySecretDialog
        fullKey={createdKey?.full_key ?? ''}
        mode="created"
        name={createdKey?.name ?? ''}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null)
        }}
        open={!!createdKey}
        planLabel={createdKey?.plan_label}
      />
    </div>
  )
}
