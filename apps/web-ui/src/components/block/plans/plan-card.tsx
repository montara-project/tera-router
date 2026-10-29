import {
  IconBell,
  IconClock,
  IconCoins,
  IconDeviceDesktop,
  IconKey,
  IconPencil,
  IconTrash,
  IconWallet,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import React, { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import PlanFormDialog from '@/components/block/plans/form'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatMicrosUsd } from '@/lib/currency'
import { formatCompact } from '@/lib/format'

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Per day',
  weekly: 'Per week',
  monthly: 'Per month',
}

/** Bar color: red once a cap is spent, amber past the alert threshold. */
function usageTone(pct: number, alertAt: number) {
  if (pct >= 100) return { bar: 'bg-red-500', text: 'text-red-400' }
  if (alertAt > 0 && pct >= alertAt) return { bar: 'bg-amber-500', text: 'text-amber-400' }
  return { bar: 'bg-emerald-500', text: 'text-muted-foreground' }
}

function formatLimit(value: number | null, prefix = '') {
  if (value === null) return 'Unlimited'

  return `${prefix}${value.toLocaleString('en-US')}`
}

interface PlanCardProps {
  plan: Models.Plan
  /** Settings → Network "Enforce API key rate limits" */
  rateLimitsEnforced: boolean
}

export default function PlanCard({ plan, rateLimitsEnforced }: PlanCardProps) {
  const [openDelete, setOpenDelete] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)

  const deleteMutation = useMutation(queries.plans.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(plan.id)
      toast.success('Plan deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error as Error)
    }
  }

  const sectionLabel =
    'flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'
  const limitLabel = 'text-muted-foreground text-[11px] font-medium tracking-wider uppercase'
  const limitValue = 'mt-1 truncate font-mono text-sm text-foreground sm:text-lg'

  return (
    <React.Fragment>
      <Card className="bg-background">
        <CardHeader className="py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60">
              <IconWallet className="h-5 w-5" />
            </span>
            <CardHeading className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <CardTitle>{plan.name}</CardTitle>
                {plan.hard_cutoff && (
                  <span className="inline-flex items-center whitespace-nowrap rounded-md bg-red-950/40 px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-900/60 ring-inset">
                    hard cutoff
                  </span>
                )}
              </div>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeading>
          </div>
          <CardToolbar className="shrink-0">
            <Button
              aria-label={`Edit ${plan.name}`}
              className="text-muted-foreground hover:text-foreground"
              mode="icon"
              onClick={() => setOpenEdit(true)}
              size="icon"
              variant="outline"
            >
              <IconPencil />
            </Button>
            <Button
              aria-label={`Delete ${plan.name}`}
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

        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="space-y-3 p-5">
              <p className={sectionLabel}>
                <IconCoins className="h-3.5 w-3.5" />
                Budget · Per key · {PERIOD_LABELS[plan.period] ?? plan.period}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className={limitLabel}>Spend</p>
                  <p className={limitValue}>{formatLimit(plan.budget_spend, '$')}</p>
                </div>
                <div className="min-w-0">
                  <p className={limitLabel}>Tokens</p>
                  <p className={limitValue}>{formatLimit(plan.budget_tokens)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 p-5">
              <p className={sectionLabel}>
                <IconClock className="h-3.5 w-3.5" />
                Rate Limits · Per Key
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="min-w-0">
                  <p className={limitLabel}>RPM</p>
                  <p className={limitValue}>{formatLimit(plan.rpm)}</p>
                </div>
                <div className="min-w-0">
                  <p className={limitLabel}>TPM</p>
                  <p className={limitValue}>{formatLimit(plan.tpm)}</p>
                </div>
                <div className="min-w-0">
                  <p className={limitLabel}>Concurrent</p>
                  <p className={limitValue}>{formatLimit(plan.concurrent)}</p>
                </div>
              </div>
              {!rateLimitsEnforced && (plan.rpm || plan.tpm || plan.concurrent) ? (
                <p className="text-xs text-amber-400">
                  Not enforced: turn on "Enforce API key rate limits" in Settings → Network.
                </p>
              ) : null}
            </div>

            {plan.key_usage.length > 0 && (
              <div className="space-y-3 p-5">
                <p className={sectionLabel}>
                  <IconKey className="h-3.5 w-3.5" />
                  Key usage · {PERIOD_LABELS[plan.period] ?? plan.period}
                </p>
                <ul className="space-y-3">
                  {plan.key_usage.map((usage) => {
                    // The cap closest to running out decides the bar.
                    const pct = Math.max(usage.spend_pct, usage.token_pct)
                    const tone = usageTone(pct, plan.alert_at_percent)
                    const parts = [
                      plan.budget_spend !== null &&
                        `${formatMicrosUsd(usage.spent_micros)} / $${plan.budget_spend.toLocaleString('en-US')}`,
                      plan.budget_tokens !== null &&
                        `${formatCompact(usage.spent_tokens)} / ${formatCompact(plan.budget_tokens)} tokens`,
                    ].filter(Boolean)
                    return (
                      <li key={usage.id} className="space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
                          <span className="min-w-0 flex-1 basis-24 truncate font-medium text-foreground">
                            {usage.name}
                          </span>
                          <span className={`shrink-0 tabular-nums ${tone.text}`}>
                            {parts.join(' · ')} · {Math.round(pct)}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={`${usage.name}: ${Math.round(pct)}% of the plan cap used`}
                        >
                          <div
                            className={`h-full ${tone.bar}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="space-y-3 p-5">
              <p className={sectionLabel}>
                <IconDeviceDesktop className="h-3.5 w-3.5" />
                Allowed Models
              </p>
              {plan.allowed_models ? (
                <div className="flex flex-wrap gap-1.5">
                  {plan.allowed_models.map((model) => (
                    <span
                      key={model}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                      {model}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">All models allowed</p>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="justify-between">
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <IconKey className="h-4 w-4" />
            {plan.keys_assigned} {plan.keys_assigned === 1 ? 'key' : 'keys'} assigned
          </span>
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <IconBell className="h-4 w-4" />
            Alert at {plan.alert_at_percent}%
          </span>
        </CardFooter>
      </Card>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Plan "${plan.name}" will be permanently deleted. Keys assigned to it will have no plan, so its limits stop applying to them.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this plan?"
        variant="destructive"
      />

      <PlanFormDialog open={openEdit} onOpenChange={setOpenEdit} plan={plan} />
    </React.Fragment>
  )
}
