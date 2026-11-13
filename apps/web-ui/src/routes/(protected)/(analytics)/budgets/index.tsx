import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import BudgetsTable, { BudgetsStats } from '@/components/block/budgets/budgets-table'
import BudgetFormDialog from '@/components/block/budgets/form'
import PlansBudgetsHeader from '@/components/block/plans/plans-budgets-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(protected)/(analytics)/budgets/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [openForm, setOpenForm] = useState(false)

  const { data } = useQuery(queries.budgets.status())
  const keysQuery = useQuery(queries.keys.list({ offset: 0, limit: 100 }))
  const accountsQuery = useQuery(queries.accounts.list({ offset: 0, limit: 1000 }))

  const keys = keysQuery.data?.data ?? []
  const accounts = accountsQuery.data?.data ?? []
  const scopeOptions = {
    api_key: keys.map((key) => ({ value: key.id, label: key.name })),
    account: accounts.map((account) => ({
      value: account.id,
      label: `${account.provider} · ${account.label || account.id.slice(0, 8)}`,
    })),
  }
  const scopeNames = new Map(
    [...scopeOptions.api_key, ...scopeOptions.account].map((option) => [option.value, option.label])
  )

  const budgets = data?.data ?? []

  return (
    <div className="flex flex-col gap-5">
      <PlansBudgetsHeader
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <IconPlus />
            <span>New budget</span>
          </Button>
        }
      />

      {data ? (
        <div className="flex flex-col gap-6">
          <BudgetsStats budgets={budgets} />
          <BudgetsTable
            budgets={budgets}
            scopeNames={scopeNames}
            scopeOptions={scopeOptions}
            onCreate={() => setOpenForm(true)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      )}

      <BudgetFormDialog open={openForm} onOpenChange={setOpenForm} scopeOptions={scopeOptions} />
    </div>
  )
}
