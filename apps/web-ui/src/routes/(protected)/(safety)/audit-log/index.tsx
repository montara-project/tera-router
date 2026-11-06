import { IconDownload, IconHistory, IconShieldCheck } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useState } from 'react'

import AuditEvents, {
  type AuditFilters,
  DEFAULT_AUDIT_FILTERS,
} from '@/components/block/audit/audit-events'
import AuditStatStrip from '@/components/block/audit/audit-stat-strip'
import PageHeader from '@/components/block/common/page-header'
import { Alert, AlertContent, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/use-debounce'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { saveFile } from '@/lib/file'

export const Route = createFileRoute('/(protected)/(safety)/audit-log/')({
  component: RouteComponent,
})

const PAGE_SIZE = 50

function RouteComponent() {
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const search = useDebounce({ value: filters.search.trim(), delay: 300 })

  const statsQuery = useQuery(queries.audit.stats())
  const listQuery = useQuery(
    queries.audit.list({
      search: search || undefined,
      outcome: filters.outcome === 'all' ? undefined : filters.outcome,
      category: filters.category === 'all' ? undefined : filters.category,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
  )
  const verifyMutation = useMutation(queries.audit.verify())
  const exportMutation = useMutation(queries.audit.exportJsonl())

  const handleFiltersChange = (patch: Partial<AuditFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const handleExport = () => {
    exportMutation.mutate(undefined, {
      onSuccess: (blob) => saveFile(blob, `audit-${format(new Date(), 'yyyyMMdd-HHmmss')}.jsonl`),
      onError: toastAxiosError,
    })
  }

  const verification = verifyMutation.data?.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={IconHistory}
        iconClassName="border-transparent bg-primary/10 text-primary"
        title="Audit log"
        description="Every dashboard sign-in and configuration change: who did it, from where, and whether it worked. Rows are hash-chained so tampering is detectable."
        actions={
          <>
            <Button
              variant="outline"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate(undefined, { onError: toastAxiosError })}
            >
              <IconShieldCheck />
              {verifyMutation.isPending ? 'Verifying…' : 'Verify integrity'}
            </Button>
            <Button variant="outline" disabled={exportMutation.isPending} onClick={handleExport}>
              <IconDownload />
              {exportMutation.isPending ? 'Exporting…' : 'Export JSONL'}
            </Button>
          </>
        }
      />

      {verification && (
        <Alert
          variant={verification.ok ? 'success' : 'destructive'}
          appearance="light"
          close
          onClose={() => verifyMutation.reset()}
        >
          <AlertContent className="flex-1">
            <AlertTitle>
              {verification.ok
                ? `Chain intact: ${verification.checked} ${verification.checked === 1 ? 'row' : 'rows'} checked`
                : `Chain broken at #${verification.broken_seq}: ${verification.reason}`}
            </AlertTitle>
            <AlertDescription>
              {verification.ok
                ? verification.legacy > 0
                  ? `${verification.legacy} older ${verification.legacy === 1 ? 'row was' : 'rows were'} written before the chain existed and ${verification.legacy === 1 ? 'is' : 'are'} not covered.`
                  : 'No row was edited, removed or reordered.'
                : `${verification.checked} ${verification.checked === 1 ? 'row' : 'rows'} before it checked out. Compare an earlier JSONL export with a new one to see what changed.`}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <AuditStatStrip stats={statsQuery.data?.data} />

      <AuditEvents
        rows={listQuery.data?.data ?? []}
        total={Number(listQuery.data?.metadata.total ?? 0)}
        loading={listQuery.isPending}
        error={listQuery.isError}
        onRetry={() => listQuery.refetch()}
        categories={statsQuery.data?.data.categories ?? []}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
