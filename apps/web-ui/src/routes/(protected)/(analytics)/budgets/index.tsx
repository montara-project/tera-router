import { IconCoins, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import BudgetCard from '@/components/block/budgets/budget-card'
import BudgetFormDialog from '@/components/block/budgets/form'
import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
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
  const accountsQuery = useQuery(queries.accounts.list({ offset: 0, limit: 100 }))

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

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    )
  }
  const budgets = data.data

  return (
    <SectionCard
      title="Budgets"
      description="Spend and token caps per period for the whole instance, an API key, or a provider account."
      toolbar={
        <Button
          className="bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:hover:bg-amber-700"
          onClick={() => setOpenForm(true)}
        >
          <IconPlus />
          <span>New budget</span>
        </Button>
      }
    >
      {budgets.length === 0 ? (
        <EmptyState
          icon={IconCoins}
          title="No budgets yet"
          description="Create a budget to alert on or block traffic once a period's spend or tokens run out."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              scopeName={scopeNames.get(budget.scope_id) ?? budget.scope_id}
              scopeOptions={scopeOptions}
            />
          ))}
        </div>
      )}

      <BudgetFormDialog open={openForm} onOpenChange={setOpenForm} scopeOptions={scopeOptions} />
    </SectionCard>
  )
}
