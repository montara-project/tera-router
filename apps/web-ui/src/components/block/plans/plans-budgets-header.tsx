import { IconReceipt } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import PageHeader from '@/components/block/common/page-header'
import { queries } from '@/lib/api/queries'

/** Shared top of /plans and /budgets: page header plus the Plans / Budgets tabs. */
export default function PlansBudgetsHeader({ actions }: { actions: React.ReactNode }) {
  const plans = useQuery(queries.plans.list()).data?.data
  const budgets = useQuery(queries.budgets.status()).data?.data

  const tabs = [
    { label: 'Plans', to: '/plans', count: plans?.length },
    { label: 'Budgets', to: '/budgets', count: budgets?.length },
  ] as const

  return (
    <>
      <PageHeader
        icon={IconReceipt}
        iconClassName="border-transparent bg-orange-500/10 text-orange-600 dark:text-orange-400"
        title="Plans & budgets"
        description="Spend, rate and model limits for your API keys."
        actions={actions}
      />
      <nav aria-label="Plans and budgets" className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: 'border-primary! text-foreground!', 'aria-current': 'page' }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-sm bg-muted px-1.5 text-[11.5px] text-muted-foreground tabular-nums">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  )
}
