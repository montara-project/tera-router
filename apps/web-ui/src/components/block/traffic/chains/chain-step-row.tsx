import { IconArrowRight, IconRefresh } from '@tabler/icons-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { CHAIN_STRATEGY } from '@/lib/constants/chain'

import { Icons } from '../../common/icons'

interface ChainStepRowProps {
  row: Models.Chain
}

export default function ChainStepRow({ row }: ChainStepRowProps) {
  const renderStep = (row: Models.Chain) => {
    if (row.steps.length > 0) {
      return (
        <React.Fragment>
          {row.steps.map((item, index) => (
            <React.Fragment key={item.position}>
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                  {item.position + 1}
                </span>
                <Icons.chatgpt className="size-3.5 shrink-0 text-white" />
                <span className="min-w-0 truncate font-mono text-xs font-medium">{item.model}</span>
              </div>

              {index < row.steps.length - 1 && (
                <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </React.Fragment>
          ))}

          {row.strategy === CHAIN_STRATEGY.ROUND_ROBIN && (
            <Button className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 bg-blue-50 ring-blue-200/70 dark:bg-blue-950/30 dark:ring-blue-900/60">
              <IconRefresh className="size-4 text-blue-600 dark:text-blue-300" />
            </Button>
          )}
        </React.Fragment>
      )
    }

    return <span className="text-xs text-muted-foreground">No steps</span>
  }

  return (
    <div className="min-w-0 p-4">
      <div className="flex flex-wrap items-center gap-1.5">{renderStep(row)}</div>
    </div>
  )
}
