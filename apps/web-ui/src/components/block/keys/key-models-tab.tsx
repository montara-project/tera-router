import { IconCpu, IconSearch } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import KeyModelsEditor, {
  ModelCells,
  useModelRows,
} from '@/components/block/keys/key-models-editor'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function KeyModelsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const [editing, setEditing] = useState(false)

  const plansQuery = useQuery(queries.plans.list())
  const plan = plansQuery.data?.data.find((item) => item.id === apiKey.plan_id) ?? null

  // A dashboard deploy can briefly outrun the API; treat a missing field as
  // "no restriction" rather than crashing on undefined.
  const allowedModels = apiKey.allowed_models ?? []
  const restricted = allowedModels.length > 0

  const saveMutation = useMutation(queries.keys.update(apiKey.id))

  const handleSave = (patterns: string[]) => {
    saveMutation.mutate(
      { allowed_models: patterns },
      {
        onSuccess: () => {
          setEditing(false)
          toast.success('Model access updated', {
            description:
              patterns.length === 0
                ? 'Every routable model works with this key.'
                : `${patterns.length} ${patterns.length === 1 ? 'model' : 'models'} allowed.`,
          })
        },
        onError: toastAxiosError,
      }
    )
  }

  const renderPlanAccess = () => {
    if (plansQuery.isLoading) {
      return 'Loading plan access…'
    }

    if (plan) {
      return (
        <>
          Plan <span className="text-foreground font-medium">{plan.name}</span> allows{' '}
          {plan.allowed_models?.length ? (
            <span className="text-foreground font-mono">{plan.allowed_models.join(', ')}</span>
          ) : (
            <span className="text-foreground">every model</span>
          )}
          . The key can only narrow that set.
        </>
      )
    }

    return 'This key is not bound to a plan, so only the key allowlist applies.'
  }

  if (editing) {
    return (
      <KeyModelsEditor
        initial={allowedModels}
        saving={saveMutation.isPending}
        note={renderPlanAccess()}
        onDiscard={() => setEditing(false)}
        onSave={handleSave}
        onAllowAll={restricted ? () => handleSave([]) : undefined}
      />
    )
  }

  return (
    <DashboardPanel
      icon={IconCpu}
      title={
        <>
          {restricted
            ? `${allowedModels.length} ${allowedModels.length === 1 ? 'model' : 'models'} allowed`
            : 'All models allowed'}
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium',
              restricted
                ? 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25 ring-inset dark:text-amber-400'
                : 'border border-border bg-muted/40 text-muted-foreground'
            )}
          >
            {restricted ? 'Key override' : 'No restriction'}
          </span>
        </>
      }
      toolbar={
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {restricted ? 'Edit access' : 'Restrict models'}
        </Button>
      }
    >
      {restricted ? (
        <AllowedModelsList allowed={allowedModels} />
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <IconCpu className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-[13px] font-semibold">No model restriction</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Every routable model works with this key.
          </p>
        </div>
      )}
    </DashboardPanel>
  )
}

/** The key's allowlist as a table: listed models by name, other entries as patterns. */
function AllowedModelsList({ allowed }: { allowed: string[] }) {
  const { rows, loading } = useModelRows()
  const [search, setSearch] = useState('')
  const [provider, setProvider] = useState('')

  const byId = new Map(rows.map((r) => [r.id, r]))
  const entries = allowed.map((id) => byId.get(id) ?? { id })
  const providers = [
    ...new Map(entries.flatMap((e) => ('slug' in e ? [[e.slug, e.provider]] : []))),
  ] as [string, string][]

  const query = search.trim().toLowerCase()
  const filtered = entries.filter(
    (e) =>
      (!provider || ('slug' in e ? e.slug === provider : provider === PATTERNS)) &&
      (!query || e.id.toLowerCase().includes(query))
  )
  const hasPatterns = entries.some((e) => !('slug' in e))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <InputWrapper className="w-full sm:w-64">
          <IconSearch aria-hidden />
          <Input
            type="search"
            aria-label="Filter models"
            placeholder="Filter models"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputWrapper>
        <select
          aria-label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm sm:w-44"
        >
          <option value="">All providers</option>
          {providers.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
          {hasPatterns ? <option value={PATTERNS}>Patterns</option> : null}
        </select>
        <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">
          {formatCount(filtered.length)} shown
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Model</th>
              <th className="w-[36%] px-4 py-2 text-left font-medium">Provider</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-2.5">
                  <Skeleton className="h-8 w-full" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                  No allowed model matches. Try another filter.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <ModelCells row={e} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Provider filter value for allowlist entries that are not a listed model. */
const PATTERNS = '__patterns'
