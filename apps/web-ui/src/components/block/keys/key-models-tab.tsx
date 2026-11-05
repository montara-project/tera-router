import { IconCpu } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

export default function KeyModelsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const plansQuery = useQuery(queries.plans.list())
  const plan = plansQuery.data?.data.find((item) => item.id === apiKey.plan_id) ?? null

  // A dashboard deploy can briefly outrun the API; treat a missing field as
  // "no restriction" rather than crashing on undefined.
  const allowedModels = apiKey.allowed_models ?? []
  const restricted = allowedModels.length > 0

  const openDialog = () => {
    setDraft(allowedModels.join('\n'))
    setOpen(true)
  }

  const saveMutation = useMutation(queries.keys.update(apiKey.id))

  const handleSave = (patterns: string[]) => {
    saveMutation.mutate(
      { allowed_models: patterns },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success(
            patterns.length === 0 ? 'Model restriction cleared' : 'Model allowlist saved'
          )
        },
        onError: toastAxiosError,
      }
    )
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSave(parsePatterns(draft))
  }

  const renderPlanAccess = () => {
    if (plansQuery.isLoading) {
      return 'Loading plan access…'
    }

    if (plan) {
      return (
        <>
          Plan <span className="text-foreground font-medium">{plan.name}</span> allows{' '}
          {plan.allowed_models?.length ? (
            <span className="text-foreground font-mono">{plan.allowed_models.join(', ')}</span>
          ) : (
            <span className="text-foreground">every model</span>
          )}
          . A key allowlist can only narrow that set, never widen it.
        </>
      )
    }

    return 'This key is not bound to a plan, so only the key allowlist applies.'
  }

  return (
    <>
      <DashboardPanel
        icon={IconCpu}
        title={
          <>
            {restricted ? 'Restricted models' : 'All models allowed'}
            <span
              className={cn(
                'rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium',
                restricted
                  ? 'bg-amber-500/10 text-amber-800 ring-1 ring-amber-500/25 ring-inset dark:text-amber-400'
                  : 'border border-border bg-muted/40 text-muted-foreground'
              )}
            >
              {restricted
                ? `${allowedModels.length} ${allowedModels.length === 1 ? 'pattern' : 'patterns'}`
                : 'No restriction'}
            </span>
          </>
        }
        toolbar={
          <Button variant="outline" size="sm" onClick={openDialog}>
            {restricted ? 'Edit allowlist' : 'Restrict models'}
          </Button>
        }
      >
        {restricted ? (
          <div className="flex flex-col gap-3 px-4 py-4">
            <p className="text-[13px] text-muted-foreground">
              Only models matching these patterns work with this key.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {allowedModels.map((pattern) => (
                <li
                  key={pattern}
                  className="inline-flex items-center rounded-sm border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                >
                  {pattern}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <IconCpu className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-[13px] font-semibold">No model restriction</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Every routable model works with this key.
            </p>
          </div>
        )}
      </DashboardPanel>

      <SimpleAlertScrollableDialogForm
        confirmText="Save allowlist"
        description={`Restrict ${apiKey.name} to a narrower set of models than its plan allows. Leave empty to follow the plan.`}
        disabled={saveMutation.isPending}
        loading={saveMutation.isPending}
        open={open}
        size="md"
        title="Restrict models"
        onOpenChange={setOpen}
        onSubmit={handleSubmit}
      >
        <p className="text-xs text-muted-foreground">{renderPlanAccess()}</p>
        <div className="space-y-1.5">
          <Label htmlFor="key-allowed-models">Allowed model patterns</Label>
          <Textarea
            id="key-allowed-models"
            className="font-mono text-xs"
            placeholder={'gpt-4o\nopenai/gpt-4o-mini\nclaude-*\nchain:fast-cheap'}
            rows={7}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            One pattern per line. Match a bare model id, <code>provider/model</code>,{' '}
            <code>chain:name</code>, or a trailing <code>*</code> wildcard.
          </p>
        </div>

        {allowedModels.length > 0 ? (
          <Button
            className="text-destructive hover:text-destructive"
            type="button"
            variant="outline"
            onClick={() => handleSave([])}
          >
            Clear restriction
          </Button>
        ) : null}
      </SimpleAlertScrollableDialogForm>
    </>
  )
}

function parsePatterns(value: string) {
  return [
    ...new Set(
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    ),
  ]
}
