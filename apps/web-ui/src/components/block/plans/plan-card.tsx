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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
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
import { throwAxiosError } from '@/lib/api/axios-error'
import { PLAN_QUERY_KEY } from '@/lib/api/queries/plan'
import { services } from '@/lib/api/services'

function formatLimit(value: number | null, prefix = '') {
  if (value === null) return 'Unlimited'

  return `${prefix}${value.toLocaleString('en-US')}`
}

interface PlanCardProps {
  plan: Models.Plan
}

export default function PlanCard({ plan }: PlanCardProps) {
  const [openDelete, setOpenDelete] = useState(false)

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      try {
        await services.plans.remove(plan.id)
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: () => {
      toast.success('Plan deleted')
      setOpenDelete(false)
      return queryClient.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] })
    },
  })

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred'
      toast.error(message)
    }
  }

  const sectionLabel =
    'flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'
  const limitLabel = 'text-muted-foreground text-[11px] font-medium tracking-wider uppercase'
  const limitValue = 'mt-1 truncate font-mono text-lg text-foreground'

  return (
    <React.Fragment>
      <Card>
        <CardHeader>
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60">
              <IconWallet className="h-5 w-5" />
            </span>
            <CardHeading className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.hardCutoff && (
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
              onClick={() => console.log('edit', plan.id)}
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
                Budget · Per Month
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <p className={limitLabel}>Spend</p>
                  <p className={limitValue}>{formatLimit(plan.budgetSpend, '$')}</p>
                </div>
                <div className="min-w-0">
                  <p className={limitLabel}>Tokens</p>
                  <p className={limitValue}>{formatLimit(plan.budgetTokens)}</p>
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
            </div>

            <div className="space-y-3 p-5">
              <p className={sectionLabel}>
                <IconDeviceDesktop className="h-3.5 w-3.5" />
                Allowed Models
              </p>
              {plan.allowedModels ? (
                <div className="flex flex-wrap gap-1.5">
                  {plan.allowedModels.map((model) => (
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
            {plan.keysAssigned} {plan.keysAssigned === 1 ? 'key' : 'keys'} assigned
          </span>
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            <IconBell className="h-4 w-4" />
            Alert at {plan.alertAtPercent}%
          </span>
        </CardFooter>
      </Card>

      <SimpleAlertDialog
        confirmText="Delete"
        description={`Plan "${plan.name}" will be permanently deleted. Keys assigned to it will fall back to defaults.`}
        onConfirm={handleDelete}
        onOpenChange={setOpenDelete}
        open={openDelete}
        title="Do you want to delete this plan?"
        variant="destructive"
      />
    </React.Fragment>
  )
}
