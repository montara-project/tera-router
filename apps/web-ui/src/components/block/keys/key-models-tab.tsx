import { IconArrowRight, IconCpu } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { ApiKeyDetail } from '@/lib/api/models/key'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { throwAxiosError } from '@/lib/api/axios-error'
import { KEY_QUERY_KEY } from '@/lib/api/queries/key'
import { planQueries } from '@/lib/api/queries/plan'
import { services } from '@/lib/api/services'

export default function KeyModelsTab({ apiKey }: { apiKey: ApiKeyDetail }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const plansQuery = useQuery(planQueries.list())
  const plan = plansQuery.data?.data.find((item) => item.id === apiKey.plan_id) ?? null

  // A dashboard deploy can briefly outrun the API; treat a missing field as
  // "no restriction" rather than crashing on undefined.
  const allowedModels = apiKey.allowed_models ?? []
  const restricted = allowedModels.length > 0

  const openDialog = () => {
    setDraft(allowedModels.join('\n'))
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (patterns: string[]) => {
      try {
        await services.keys.update(apiKey.id, { allowed_models: patterns })
      } catch (error) {
        throwAxiosError(error as Error)
      }
    },
    onSuccess: async (_data, patterns) => {
      await queryClient.invalidateQueries({ queryKey: [KEY_QUERY_KEY] })
      setOpen(false)
      toast.success(patterns.length === 0 ? 'Model restriction cleared' : 'Model allowlist saved')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'An error occurred'),
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate(parsePatterns(draft))
  }

  return (
    <>
      <Card className="bg-background">
        <CardHeader className="h-20">
          <CardHeading>
            <CardTitle>Model access</CardTitle>
            <CardDescription>
              Choose whether this key follows its plan or uses a narrower model allowlist.
            </CardDescription>
          </CardHeading>
          <CardToolbar>
            <Button variant="outline" onClick={openDialog}>
              Restrict models
              <IconArrowRight />
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="bg-background flex items-start gap-4 rounded-lg border border-border p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-950 text-amber-400">
              <IconCpu className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {restricted ? 'Restricted allowlist' : 'All available models'}
                </p>
                <Badge variant={restricted ? 'warning' : 'secondary'} appearance="light" size="sm">
                  {restricted
                    ? `${allowedModels.length} ${allowedModels.length === 1 ? 'pattern' : 'patterns'}`
                    : 'No restriction'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {restricted
                  ? 'Only models matching the patterns below are reachable through this key.'
                  : 'This key can use every model available through its assigned plan.'}
              </p>

              {restricted ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {allowedModels.map((pattern) => (
                    <span
                      key={pattern}
                      className="bg-muted text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-muted-foreground text-xs">
            {plansQuery.isLoading ? (
              'Loading plan access…'
            ) : plan ? (
              <>
                Plan <span className="text-foreground font-medium">{plan.name}</span> allows{' '}
                {plan.allowed_models?.length ? (
                  <span className="text-foreground font-mono">
                    {plan.allowed_models.join(', ')}
                  </span>
                ) : (
                  <span className="text-foreground">every model</span>
                )}
                . A key allowlist can only narrow that set, never widen it.
              </>
            ) : (
              'This key is not bound to a plan, so only the key allowlist applies.'
            )}
          </div>
        </CardContent>
      </Card>

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
            onClick={() => saveMutation.mutate([])}
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
