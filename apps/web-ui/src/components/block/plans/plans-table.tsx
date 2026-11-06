import type { ColumnDef } from '@tanstack/react-table'

import { IconTemplate } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import PlanFormDialog from '@/components/block/plans/form'
import { Button } from '@/components/ui/button'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatCompact } from '@/lib/format'

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

const muted = 'text-muted-foreground'
const sub = 'block text-xs text-muted-foreground'

function budgetText(plan: Models.Plan) {
  const parts = [
    plan.budget_spend !== null && `$${plan.budget_spend.toLocaleString('en-US')}`,
    plan.budget_tokens !== null && `${formatCompact(plan.budget_tokens)} tokens`,
  ].filter(Boolean)
  return parts.join(' · ')
}

function rateText(plan: Models.Plan) {
  const parts = [
    plan.rpm !== null && `${formatCompact(plan.rpm)} RPM`,
    plan.tpm !== null && `${formatCompact(plan.tpm)} TPM`,
    plan.concurrent !== null && `${plan.concurrent} concurrent`,
  ].filter(Boolean)
  return parts.join(' · ')
}

interface PlansTableProps {
  plans: Models.Plan[]
  /** Settings → Network "Enforce API key rate limits" */
  rateLimitsEnforced: boolean
  onCreate: () => void
}

/** "Plan templates" panel: one row per plan with its limits at a glance. */
export default function PlansTable({ plans, rateLimitsEnforced, onCreate }: PlansTableProps) {
  // The list arrives whole, so paging runs here; the pager keeps its page in ?page.
  const { offset, limit, pageIndex } = usePaginationQuery()

  // The target outlives its dialog's open flag so the dialog keeps its content while closing.
  const [editing, setEditing] = useState<Models.Plan | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState<Models.Plan | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteMutation = useMutation(queries.plans.delete())

  const columns = ((): ColumnDef<typeof features, Models.Plan, unknown>[] => {
    const edit = (plan: Models.Plan) => {
      setEditing(plan)
      setEditOpen(true)
    }
    return [
      {
        id: 'plan',
        header: 'Plan',
        meta: { headerClassName: 'w-[29%]', cellClassName: 'max-w-0' },
        cell: ({ row }) => {
          const plan = row.original
          return (
            <>
              <button
                type="button"
                onClick={() => edit(plan)}
                className="block max-w-full truncate rounded-sm text-left font-medium hover:underline"
                title={plan.name}
              >
                {plan.name}
              </button>
              {plan.description ? (
                <span className={`${sub} truncate`} title={plan.description}>
                  {plan.description}
                </span>
              ) : null}
            </>
          )
        },
      },
      {
        id: 'budget',
        header: 'Budget',
        cell: ({ row }) => {
          const budget = budgetText(row.original)
          return (
            <>
              <span className={budget ? undefined : muted}>{budget || 'Unlimited'}</span>
              <span className={sub}>
                {PERIOD_LABELS[row.original.period] ?? row.original.period}
              </span>
            </>
          )
        },
      },
      {
        id: 'rate',
        header: 'Rate limits',
        cell: ({ row }) => {
          const rate = rateText(row.original)
          return (
            <>
              <span className={rate ? undefined : muted}>{rate || 'None'}</span>
              {rate && !rateLimitsEnforced ? (
                <span className="block text-xs text-amber-600 dark:text-amber-400">
                  Not enforced in Settings
                </span>
              ) : null}
            </>
          )
        },
      },
      {
        id: 'models',
        header: 'Models',
        cell: ({ row }) => {
          const models = row.original.allowed_models
          return models ? (
            <span title={models.join('\n')}>
              {models.length} {models.length === 1 ? 'model' : 'models'}
            </span>
          ) : (
            <span className={muted}>All models</span>
          )
        },
      },
      {
        id: 'enforcement',
        header: 'Enforcement',
        cell: ({ row }) => (
          <>
            <span className="inline-flex h-5 items-center rounded-sm border border-border bg-card px-1.5 text-[11.5px] font-medium">
              {row.original.hard_cutoff ? 'Hard cutoff' : 'Alert only'}
            </span>
            <span className={sub}>Alert at {row.original.alert_at_percent}%</span>
          </>
        ),
      },
      {
        accessorKey: 'keys_assigned',
        header: 'Keys',
        meta: { headerClassName: 'w-[9%]', cellClassName: 'tabular-nums' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        cell: ({ row }) => (
          <RowColumnAction
            noun="plan"
            name={row.original.name}
            onEdit={() => edit(row.original)}
            onDelete={() => {
              setDeleting(row.original)
              setDeleteOpen(true)
            }}
          />
        ),
      },
    ]
  })()

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      toast.success('Plan deleted')
      setDeleteOpen(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <SectionCardPanel icon={IconTemplate} title="Plan templates">
      {plans.length === 0 ? (
        <EmptyState
          icon={IconTemplate}
          title="No plans yet"
          description="Create a plan to give API keys budget limits, rate limits and model restrictions."
          action={<Button onClick={onCreate}>New plan</Button>}
        />
      ) : (
        <ReactTable
          total={plans.length}
          data={plans.slice(offset, offset + limit)}
          pageIndex={pageIndex}
          pageSize={limit}
          pageSizes={PAGE_SIZES}
          columns={columns}
          tableClassName="min-w-[60rem]"
        />
      )}

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Plan "${deleting?.name ?? ''}" will be permanently deleted. Keys assigned to it will have no plan, so its limits stop applying to them.`}
        onConfirm={handleDelete}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Delete this plan?"
        variant="destructive"
      />
      {editing && <PlanFormDialog open={editOpen} onOpenChange={setEditOpen} plan={editing} />}
    </SectionCardPanel>
  )
}
