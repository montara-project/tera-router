import { IconBell, IconPencil, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { BudgetStatus } from '@/lib/api/models/budget'
import type { Option } from '@/types/select'

import BudgetFormDialog, { SCOPE_LABELS } from '@/components/block/budgets/form'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact } from '@/lib/format'

interface BudgetCardProps {
  budget: BudgetStatus
  /** Display name of the scoped key or account. */
  scopeName: string
  scopeOptions: Record<'api_key' | 'account', Option<unknown>[]>
}

export default function BudgetCard({ budget, scopeName, scopeOptions }: BudgetCardProps) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const deleteMutation = useMutation(queries.budgets.delete())

  const handleDelete = () => {
    deleteMutation.mutate(budget.id, {
      onSuccess: () => {
        toast.success('Budget deleted')
        setOpenDelete(false)
      },
      onError: toastAxiosError,
    })
  }

  const title = budget.scope_kind === 'tenant' ? SCOPE_LABELS.tenant : scopeName
  const meters = [
    budget.limit_micros > 0 && {
      label: 'Spend',
      used: formatMicrosUsd(budget.spent_micros),
      limit: formatMicrosUsd(budget.limit_micros),
      pct: budget.spend_pct,
    },
    budget.limit_tokens > 0 && {
      label: 'Tokens',
      used: formatCompact(budget.spent_tokens),
      limit: formatCompact(budget.limit_tokens),
      pct: budget.token_pct,
    },
  ].filter((meter) => meter !== false)

  return (
    <>
      <Card className="bg-background">
        <CardHeader className="h-20">
          <CardHeading className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate">{title}</CardTitle>
              {budget.hard_cutoff && (
                <span className="inline-flex items-center rounded-md bg-red-950/40 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-red-400 ring-1 ring-red-900/60 ring-inset">
                  hard cutoff
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {SCOPE_LABELS[budget.scope_kind]} · {budget.period}
            </p>
          </CardHeading>
          <CardToolbar className="shrink-0">
            <Button
              aria-label={`Edit budget for ${title}`}
              className="text-muted-foreground hover:text-foreground"
              mode="icon"
              onClick={() => setOpenEdit(true)}
              size="icon"
              variant="outline"
            >
              <IconPencil />
            </Button>
            <Button
              aria-label={`Delete budget for ${title}`}
              className="text-muted-foreground hover:text-foreground"
              mode="icon"
              onClick={() => setOpenDelete(true)}
              size="icon"
              variant="outline"
            >
              <IconTrash />
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent className="space-y-4 p-5">
          {meters.length === 0 ? (
            <p className="text-muted-foreground text-sm">No limit set — this budget only tracks.</p>
          ) : (
            meters.map((meter) => (
              <div key={meter.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground text-xs">{meter.label}</span>
                  <span className="font-mono text-xs">
                    {meter.used} / {meter.limit} · {Math.round(meter.pct)}%
                  </span>
                </div>
                <Progress value={Math.min(meter.pct, 100)} />
              </div>
            ))
          )}
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <IconBell className="h-3.5 w-3.5" />
            Alert at {budget.alert_pct}%
          </p>
        </CardContent>
      </Card>

      <BudgetFormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        budget={budget}
        scopeOptions={scopeOptions}
      />
      <SimpleAlertDialog
        confirmText="Delete"
        description={`The budget for "${title}" will be permanently deleted and stop capping traffic.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this budget?"
        variant="destructive"
      />
    </>
  )
}
