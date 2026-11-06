import { IconListDetails, IconRefresh } from '@tabler/icons-react'
import { useMemo, useState } from 'react'

import type { GuardrailsDecisionEntry } from '@/lib/api/models/guardrails'

import SelectInput from '@/components/block/common/select-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const DECISION_LABELS: Record<string, string> = {
  block: 'Blocked',
  redact: 'Redacted',
  mask: 'Masked',
  hash: 'Hashed',
  warn: 'Warned',
  log: 'Log only',
}

const DECISION_CLASSES: Record<string, string> = {
  block: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400',
  redact: 'border-primary/20 bg-primary/10 text-primary',
  mask: 'border-primary/20 bg-primary/10 text-primary',
  hash: 'border-primary/20 bg-primary/10 text-primary',
  warn: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  log: 'border-border bg-muted text-foreground',
}

const DETECTOR_LABELS: Record<string, string> = {
  pii: 'PII',
  injection: 'Injection',
  topics: 'Topics',
  toxicity: 'Toxicity',
  bias: 'Bias',
}

const COLUMNS = 'grid grid-cols-[9.5rem_7rem_1fr_10rem_11rem] items-center gap-4'

interface GuardrailsAuditLogProps {
  decisions: GuardrailsDecisionEntry[]
  live: boolean
  onLiveChange: (live: boolean) => void
  refreshing: boolean
  onRefresh: () => void
}

/** Audit tab: every decision the gateway took, newest first. */
export default function GuardrailsAuditLog({
  decisions,
  live,
  onLiveChange,
  refreshing,
  onRefresh,
}: GuardrailsAuditLogProps) {
  const [detector, setDetector] = useState('all')
  const [decision, setDecision] = useState('all')

  const rows = useMemo(
    () =>
      decisions.filter(
        (entry) =>
          (detector === 'all' || entry.detectors.includes(detector)) &&
          (decision === 'all' || entry.decision === decision)
      ),
    [decisions, detector, decision]
  )

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="flex items-center gap-2.5 text-[13px] font-semibold">
            <IconListDetails className="text-primary size-4" stroke={1.75} aria-hidden />
            Audit log
          </h2>
          <span className="flex items-center gap-2">
            <Switch
              size="sm"
              checked={live}
              onCheckedChange={onLiveChange}
              aria-label="Live updates"
            />
            <span className="text-[12.5px] font-medium">Live</span>
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  live ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                )}
                aria-hidden
              />
              {live ? 'Refreshing every 15s' : 'Paused'}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectInput
            aria-label="Detector"
            value={detector}
            onSelect={setDetector}
            className="w-40"
            options={[
              { value: 'all', label: 'All detectors' },
              ...Object.entries(DETECTOR_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <SelectInput
            aria-label="Decision"
            value={decision}
            onSelect={setDecision}
            className="w-40"
            options={[
              { value: 'all', label: 'All decisions' },
              ...Object.entries(DECISION_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
            aria-label="Refresh decisions"
          >
            <IconRefresh className={cn(refreshing && 'motion-safe:animate-spin')} />
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
            <IconListDetails className="size-5" aria-hidden />
          </span>
          <h3 className="mt-3 text-[13px] font-semibold">No audit entries yet</h3>
          <p className="text-muted-foreground mt-1 text-[12.5px]">
            Decisions appear here as guardrails fire.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div className={`${COLUMNS} border-b border-border px-4 py-2`}>
              <p className="text-muted-foreground text-xs font-medium">Time</p>
              <p className="text-muted-foreground text-xs font-medium">Decision</p>
              <p className="text-muted-foreground text-xs font-medium">Detectors · reason</p>
              <p className="text-muted-foreground text-xs font-medium">API key</p>
              <p className="text-muted-foreground text-xs font-medium">Model</p>
            </div>
            <div className="divide-y divide-border">
              {rows.map((entry) => (
                <div key={entry.id} className={`${COLUMNS} px-4 py-2.5`}>
                  <p className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    {entry.time}
                  </p>
                  <span
                    className={cn(
                      'inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                      DECISION_CLASSES[entry.decision] ?? DECISION_CLASSES.log
                    )}
                  >
                    {DECISION_LABELS[entry.decision] ?? entry.decision}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {entry.detectors.length === 0 ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      entry.detectors.map((key) => (
                        <Badge key={key} variant="secondary" size="sm">
                          {DETECTOR_LABELS[key] ?? key}
                        </Badge>
                      ))
                    )}
                    {entry.reasons.length > 0 ? (
                      <span
                        className="text-muted-foreground truncate font-mono text-[11px]"
                        title={entry.reasons.join(', ')}
                      >
                        {entry.reasons.join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs" title={entry.key_name}>
                    {entry.key_name || '—'}
                  </p>
                  <p className="truncate font-mono text-xs" title={entry.model}>
                    {entry.model || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
