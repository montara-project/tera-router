import { IconKey } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDate, formatTimeAgo } from '@/lib/date'

import FilterKeys, { type KeysFilters, type KeysSortValue, SORT_OPTIONS } from './filter-keys'
import KeyActionsMenu from './key-actions-menu'

const STATUS_LABEL: Record<Models.ApiKeyStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
  restricted: 'Restricted',
}

interface KeysTableProps {
  /** every key, for the chip counts */
  keys: Models.ApiKey[]
  /** keys after search, status and sort */
  rows: Models.ApiKey[]
  loading: boolean
  filters: KeysFilters
  onFiltersChange: (patch: Partial<KeysFilters>) => void
  onCreate: () => void
}

export default function KeysTable({
  keys,
  rows,
  loading,
  filters,
  onFiltersChange,
  onCreate,
}: KeysTableProps) {
  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )
    }
    if (keys.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconKey}
          title="No API keys yet"
          description="Create a key for each tool or teammate that calls the router."
          action={
            <Button size="sm" onClick={onCreate}>
              New key
            </Button>
          }
        />
      )
    }
    if (rows.length === 0) {
      return (
        <EmptyState
          className="border-0"
          icon={IconKey}
          title="No keys match"
          description="Try another name, key or plan, or clear the status filter."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFiltersChange({ search: '', status: 'all' })}
            >
              Clear filters
            </Button>
          }
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="w-[24%] px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Plan</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Last used</th>
              <th className="px-4 py-2 text-left font-medium">Created</th>
              <th className="w-12 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => (
              <KeyRow key={key.id} record={key} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <DashboardPanel
      icon={IconKey}
      title="Keys"
      toolbar={
        <select
          aria-label="Sort keys"
          value={filters.sort}
          onChange={(e) => onFiltersChange({ sort: e.target.value as KeysSortValue })}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      }
    >
      {keys.length > 0 && <FilterKeys keys={keys} filters={filters} onChange={onFiltersChange} />}
      {renderBody()}
    </DashboardPanel>
  )
}

function KeyRow({ record }: { record: Models.ApiKey }) {
  const toggleMutation = useMutation(queries.keys.toggleStatus())
  const enabled = record.status !== 'disabled'

  const handleToggle = async (on: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: record.id, disabled: !on })
      toast.success(`Key ${on ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-0 px-4 py-2.5">
        <Link
          to="/keys/$keyId"
          params={{ keyId: record.id }}
          className="block truncate rounded-sm font-medium hover:underline"
          title={record.name}
        >
          {record.name}
        </Link>
        <code className="block truncate font-mono text-xs text-muted-foreground">
          {record.key_preview}
        </code>
      </td>
      <td className="px-4 py-2.5">
        <span className="block">{record.plan_label}</span>
        {record.plan_note ? (
          <span className="block text-xs text-muted-foreground">{record.plan_note}</span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Switch
            checked={enabled}
            disabled={toggleMutation.isPending}
            onCheckedChange={(on) => void handleToggle(on)}
            aria-label={`${record.name} enabled`}
          />
          <span className="text-xs text-muted-foreground">{STATUS_LABEL[record.status]}</span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        {record.last_used_at ? (
          <span title={formatDate(record.last_used_at)}>{formatTimeAgo(record.last_used_at)}</span>
        ) : (
          <span className="text-muted-foreground">Never</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(record.created_at)}</td>
      <td className="px-2 py-2.5 text-right">
        <KeyActionsMenu record={record} showDetails />
      </td>
    </tr>
  )
}
