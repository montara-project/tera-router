import { IconDotsVertical, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import OverrideDialog from '@/components/block/traffic/pricing/override-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { EMERALD_BUTTON_CLASS } from '@/lib/constants/ui'

const COLUMNS = 'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_repeat(2,minmax(0,1fr))_auto] gap-3'

/** Render a USD-per-million rate; 0 shows "free" so a real zero is visible. */
function formatRate(micros: number): string {
  if (micros === 0) return 'free'
  return `$${(micros / 1_000_000).toFixed(4).replace(/\.?0+$/, '')}`
}

function describeModel(model: string): string {
  return model === '' ? '(all models)' : model
}

interface PricingOverridesCardProps {
  providers: Models.Provider[]
  providersLoading: boolean
}

export default function PricingOverridesCard({
  providers,
  providersLoading,
}: PricingOverridesCardProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Models.PricingOverride | null>(null)
  const [deleting, setDeleting] = useState<Models.PricingOverride | null>(null)

  const { data, isLoading, isFetching } = useQuery(queries.overrides.pricingList())

  const deleteMutation = useMutation(queries.overrides.pricingDelete())

  const overrides = data?.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return overrides
    return overrides.filter(
      (row) => row.provider.toLowerCase().includes(q) || row.model.toLowerCase().includes(q)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `overrides` is a stable `data?.data ?? []` derived from the query cache
  }, [data, search])

  const handleDelete = async (override: Models.PricingOverride) => {
    try {
      await deleteMutation.mutateAsync({ provider: override.provider, model: override.model })
      toast.success('Pricing override deleted')
    } catch (error) {
      toastAxiosError(error)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card className="bg-background">
      <CardHeader className="h-20">
        <CardHeading>
          <CardTitle>Pricing overrides</CardTitle>
          <CardDescription>
            Operator-set per-model rates. Overrides beat the built-in catalog; changes take effect
            on the next request.
          </CardDescription>
        </CardHeading>
        <Button
          size="sm"
          className={EMERALD_BUTTON_CLASS}
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <IconPlus /> Add override
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by provider or model..."
              aria-label="Search pricing overrides"
              className="h-10 pl-9"
            />
          </div>
          {!isLoading && overrides.length > 0 ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {search
                ? `${filtered.length} of ${overrides.length} overrides`
                : `${overrides.length} override${overrides.length === 1 ? '' : 's'}`}
            </p>
          ) : null}
        </div>

        {isLoading || providersLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconSearch />
              </EmptyMedia>
              <EmptyTitle>
                {search ? 'No overrides match your search' : 'No pricing overrides yet'}
              </EmptyTitle>
              <EmptyDescription>
                {search
                  ? 'Try a shorter name or clear the search to see every override.'
                  : 'Built-in catalog pricing applies by default. Add an override to charge a custom rate for a provider or model.'}
              </EmptyDescription>
            </EmptyHeader>
            {search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            ) : (
              <Button
                size="sm"
                className={EMERALD_BUTTON_CLASS}
                onClick={() => {
                  setEditing(null)
                  setDialogOpen(true)
                }}
              >
                <IconPlus /> Add override
              </Button>
            )}
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className={`${COLUMNS} border-b border-border bg-muted/40 px-4 py-2.5`}>
              {['Provider', 'Model', 'Input $/M', 'Output $/M', ''].map((label, i) => (
                <p
                  key={i}
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {label}
                </p>
              ))}
            </div>
            <div className={`divide-y divide-border/60 ${isFetching ? 'opacity-60' : ''}`}>
              {filtered.map((row) => (
                <div key={`${row.id}`} className={`${COLUMNS} items-center px-4 py-3`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {row.provider}
                    </span>
                    {row.model === '' ? (
                      <Badge variant="secondary" appearance="light" size="sm">
                        provider-wide
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate font-mono text-xs text-foreground">
                    {describeModel(row.model)}
                  </p>
                  <p className="text-sm tabular-nums text-foreground">
                    {formatRate(row.input_micros)}
                  </p>
                  <p className="text-sm tabular-nums text-foreground">
                    {formatRate(row.output_micros)}
                  </p>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Override actions">
                          <IconDotsVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(row)
                            setDialogOpen(true)
                          }}
                        >
                          <IconPencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                          <IconTrash /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <OverrideDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        override={editing}
        providers={providers}
      />

      <SimpleAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete pricing override?"
        description={
          deleting
            ? `Delete the override for ${deleting.provider}${describeModel(deleting.model) === '(all models)' ? ' (all models)' : ` / ${deleting.model}`}? Built-in catalog pricing takes over.`
            : ''
        }
        confirmText="Delete override"
        onConfirm={() => deleting && handleDelete(deleting)}
        variant="destructive"
      />
    </Card>
  )
}
