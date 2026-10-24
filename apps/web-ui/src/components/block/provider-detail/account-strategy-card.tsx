import { IconGitFork, IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type Strategy = Models.ProviderRouting['strategy']

const STRATEGIES: { value: Strategy; title: string; description: string }[] = [
  { value: 'default', title: 'Router default', description: 'Follows Settings › Routing' },
  {
    value: 'fill-first',
    title: 'Fill first',
    description: "Top healthy account until it's unavailable",
  },
  { value: 'round-robin', title: 'Round robin', description: 'Rotate accounts every few requests' },
  {
    value: 'smart-round-robin',
    title: 'Smart round robin',
    description: 'Rotate new sessions, keep conversations on one account',
  },
]

/** Draft of the form; the numbers stay strings so a field can be cleared while typing. */
type Draft = { strategy: Strategy; stickyLimit: string; affinityHours: string }

const toDraft = (r: Models.ProviderRouting): Draft => ({
  strategy: r.strategy,
  stickyLimit: String(r.sticky_limit),
  affinityHours: String(r.affinity_hours),
})

const inRange = (raw: string, min: number, max: number) => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= min && n <= max
}

/**
 * How the gateway spreads this provider's requests over its accounts. Stored
 * per provider slug; "Router default" defers to the global Settings › Routing.
 */
export default function AccountStrategyCard({ slug }: { slug: string }) {
  const routingQuery = useQuery(queries.providers.routing(slug))
  const updateMutation = useMutation(queries.providers.updateRouting(slug))
  const [draft, setDraft] = useState<Draft | null>(null)

  const saved = routingQuery.data?.data
  if (!saved) {
    return routingQuery.isLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : null
  }

  const form = draft ?? toDraft(saved)
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(toDraft(saved))
  const rotates = form.strategy === 'round-robin' || form.strategy === 'smart-round-robin'
  const smart = form.strategy === 'smart-round-robin'
  const stickyValid = inRange(form.stickyLimit, 1, 1000)
  const affinityValid = inRange(form.affinityHours, 1, 720)

  const update = (patch: Partial<Draft>) => setDraft({ ...form, ...patch })

  const save = async () => {
    try {
      await updateMutation.mutateAsync({
        strategy: form.strategy,
        sticky_limit: Number(form.stickyLimit),
        affinity_hours: Number(form.affinityHours),
      })
      setDraft(null)
      toast.success('Account strategy saved')
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <Card className="bg-background">
      <CardHeader className="min-h-14">
        <CardHeading>
          <CardTitle className="flex items-center gap-2">
            <IconGitFork className="size-4 text-emerald-500" />
            Account strategy
          </CardTitle>
        </CardHeading>
      </CardHeader>

      <CardContent className="p-0">
        <RadioGroup
          aria-label="Account strategy"
          value={form.strategy}
          onValueChange={(value) => update({ strategy: value as Strategy })}
          className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2"
        >
          {STRATEGIES.map((option) => (
            <Label
              key={option.value}
              htmlFor={`strategy-${option.value}`}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/40',
                form.strategy === option.value && 'border-primary bg-primary/5 hover:bg-primary/5'
              )}
            >
              <RadioGroupItem
                id={`strategy-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">{option.title}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        {rotates ? (
          <div className="grid grid-cols-1 gap-5 border-t border-border p-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sticky-limit">
                {smart ? 'New sessions before rotating' : 'Requests before rotating'}
              </Label>
              <Input
                id="sticky-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={form.stickyLimit}
                aria-invalid={!stickyValid}
                className="w-32 font-mono"
                onChange={(e) => update({ stickyLimit: e.target.value })}
              />
              <p
                className={cn(
                  'text-xs',
                  stickyValid ? 'text-muted-foreground' : 'text-destructive'
                )}
              >
                {stickyValid ? 'Per account, before the next takes over' : 'Enter 1 to 1000'}
              </p>
            </div>
            {smart ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="affinity-hours">Session affinity (hours)</Label>
                <Input
                  id="affinity-hours"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={720}
                  value={form.affinityHours}
                  aria-invalid={!affinityValid}
                  className="w-32 font-mono"
                  onChange={(e) => update({ affinityHours: e.target.value })}
                />
                <p
                  className={cn(
                    'text-xs',
                    affinityValid ? 'text-muted-foreground' : 'text-destructive'
                  )}
                >
                  {affinityValid
                    ? 'How long a quiet conversation stays on its account'
                    : 'Enter 1 to 720'}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border px-5 py-4">
        <p className="text-xs text-muted-foreground">{dirty ? 'Unsaved changes' : 'Saved'}</p>
        <Button
          size="sm"
          disabled={
            !dirty ||
            updateMutation.isPending ||
            (rotates && !stickyValid) ||
            (smart && !affinityValid)
          }
          onClick={() => void save()}
        >
          {updateMutation.isPending ? <IconLoader2 className="animate-spin" /> : null}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  )
}
