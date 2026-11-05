import { IconDots, IconEdit, IconTemplate, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import PlanFormDialog from '@/components/block/plans/form'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatCompact } from '@/lib/format'

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

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
  return (
    <DashboardPanel icon={IconTemplate} title="Plan templates">
      {plans.length === 0 ? (
        <EmptyState
          icon={IconTemplate}
          title="No plans yet"
          description="Create a plan to give API keys budget limits, rate limits and model restrictions."
          action={<Button onClick={onCreate}>New plan</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-[13px]">
            <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
              <tr>
                <th className="w-[29%] px-4 py-2 text-left font-medium">Plan</th>
                <th className="px-4 py-2 text-left font-medium">Budget</th>
                <th className="px-4 py-2 text-left font-medium">Rate limits</th>
                <th className="px-4 py-2 text-left font-medium">Models</th>
                <th className="px-4 py-2 text-left font-medium">Enforcement</th>
                <th className="w-[9%] px-4 py-2 text-left font-medium">Keys</th>
                <th className="w-12 px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} rateLimitsEnforced={rateLimitsEnforced} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  )
}

function PlanRow({ plan, rateLimitsEnforced }: { plan: Models.Plan; rateLimitsEnforced: boolean }) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const deleteMutation = useMutation(queries.plans.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(plan.id)
      toast.success('Plan deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const budget = budgetText(plan)
  const rate = rateText(plan)
  const models = plan.allowed_models

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-0 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpenEdit(true)}
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
      </td>
      <td className="px-4 py-2.5">
        <span className={budget ? undefined : muted}>{budget || 'Unlimited'}</span>
        <span className={sub}>{PERIOD_LABELS[plan.period] ?? plan.period}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={rate ? undefined : muted}>{rate || 'None'}</span>
        {rate && !rateLimitsEnforced ? (
          <span className="block text-xs text-amber-600 dark:text-amber-400">
            Not enforced in Settings
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        {models ? (
          <span title={models.join('\n')}>
            {models.length} {models.length === 1 ? 'model' : 'models'}
          </span>
        ) : (
          <span className={muted}>All models</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="inline-flex h-5 items-center rounded-sm border border-border bg-card px-1.5 text-[11.5px] font-medium">
          {plan.hard_cutoff ? 'Hard cutoff' : 'Alert only'}
        </span>
        <span className={sub}>Alert at {plan.alert_at_percent}%</span>
      </td>
      <td className="px-4 py-2.5 tabular-nums">{plan.keys_assigned}</td>
      <td className="px-2 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${plan.name}`}
            >
              <IconDots className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onClick={() => setOpenEdit(true)}>
              <IconEdit />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setOpenDelete(true)}>
              <IconTrash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SimpleAlertDialog
          confirmText="Delete"
          description={`Plan "${plan.name}" will be permanently deleted. Keys assigned to it will have no plan, so its limits stop applying to them.`}
          onConfirm={handleDelete}
          onOpenChange={setOpenDelete}
          open={openDelete}
          title="Delete this plan?"
          variant="destructive"
        />
        <PlanFormDialog open={openEdit} onOpenChange={setOpenEdit} plan={plan} />
      </td>
    </tr>
  )
}
