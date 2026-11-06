import { IconKey, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import type { KeysFilters } from '@/components/block/keys/filter-keys'
import type { Models } from '@/lib/api/models'

import PageHeader from '@/components/block/common/page-header'
import { applyKeysFilters, DEFAULT_KEYS_FILTERS } from '@/components/block/keys/filter-keys'
import { AddKeyForm } from '@/components/block/keys/form'
import KeySecretDialog from '@/components/block/keys/key-secret-dialog'
import KeysTable from '@/components/block/keys/keys-table'
import { Button } from '@/components/ui/button'
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

  // ponytail: one page of 100 keys, filtered client-side; page server-side past that.
  const { data, isLoading } = useQuery(keyQueries.list({ offset: 0, limit: 100 }))
  const keys = useMemo(() => data?.data ?? [], [data])
  const rows = useMemo(() => applyKeysFilters(keys, filters), [keys, filters])

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
        keys={keys}
        rows={rows}
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
