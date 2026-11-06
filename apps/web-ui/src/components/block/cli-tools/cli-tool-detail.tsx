import {
  IconAlertTriangle,
  IconArrowLeft,
  IconChevronRight,
  IconCircleCheck,
  IconFileCode,
  IconRefresh,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import type { CliTool } from '@/lib/constants/cli-tools'

import { ToolLogo } from '@/components/block/cli-tools/cli-tools-grid'
import { ConfigFiles, EnvTable } from '@/components/block/cli-tools/config-files'
import EmptyState from '@/components/block/common/empty-state'
import SegmentedControl from '@/components/block/common/segmented-control'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { env } from '@/config/env'
import { useDebounce } from '@/hooks/use-debounce'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { CLI_TOOL_QUERY_KEY } from '@/lib/api/queries/cli-tool'
import { CLI_TOOLS } from '@/lib/constants/cli-tools'
import { cn } from '@/lib/utils'

type KeyMode = 'create' | 'paste'

const KEY_MODES = [
  { value: 'create', label: 'Create new' },
  { value: 'paste', label: 'Paste key' },
] as const

const isHttpUrl = (value: string) => {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const BACK_LINK_CLASS =
  'text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm transition-colors'

/** /cli-tools/$toolId: install, choose endpoint/key/model, write, or copy by hand. */
export default function CliToolDetail({ toolId }: { toolId: string }) {
  const tool = CLI_TOOLS.find((t) => t.id === toolId)
  if (!tool) {
    return (
      <EmptyState
        title="Unknown CLI tool"
        description={`There is no setup for "${toolId}".`}
        action={
          <Button asChild variant="outline">
            <Link to="/cli-tools">
              <IconArrowLeft />
              Back to CLI tools
            </Link>
          </Button>
        }
      />
    )
  }
  return <ToolSetup tool={tool} />
}

function ToolSetup({ tool }: { tool: CliTool }) {
  const queryClient = useQueryClient()
  const [baseUrl, setBaseUrl] = useState(env.VITE_API_URL)
  const [keyMode, setKeyMode] = useState<KeyMode>('create')
  const [keyName, setKeyName] = useState(`${tool.name} (CLI)`)
  const [pastedKey, setPastedKey] = useState('')
  const [model, setModel] = useState('')
  const [written, setWritten] = useState<string | null>(null)

  const previewBase = useDebounce({ value: baseUrl.trim(), delay: 300 })
  const previewModel = useDebounce({ value: model.trim(), delay: 300 })
  const detailQuery = useQuery(
    queries.cliTools.detail(tool.id, { base_url: previewBase, model: previewModel })
  )
  const applyMutation = useMutation(queries.cliTools.apply(tool.id))
  const detail = detailQuery.data
  const modelRequired = detail?.model_required ?? true

  const missing = !isHttpUrl(baseUrl.trim())
    ? 'Enter the endpoint URL first.'
    : keyMode === 'create' && !keyName.trim()
      ? 'Name the new key first.'
      : keyMode === 'paste' && !pastedKey.trim()
        ? 'Paste an API key first.'
        : modelRequired && !model.trim()
          ? 'Pick a default model first.'
          : null

  const handleWrite = () => {
    setWritten(null)
    applyMutation.mutate(
      {
        base_url: baseUrl.trim(),
        model: model.trim(),
        ...(keyMode === 'create' ? { key_name: keyName.trim() } : { api_key: pastedKey.trim() }),
      },
      {
        onSuccess: (res) => {
          const what = keyMode === 'create' ? `new key “${res.data.key.name}”` : 'the pasted key'
          setWritten(`Wrote ${res.data.files.join(', ')} with ${what}.`)
          toast.success(`${tool.name} configured`)
          void queryClient.invalidateQueries({ queryKey: [CLI_TOOL_QUERY_KEY, 'list'] })
        },
        onError: toastAxiosError,
      }
    )
  }

  const rescan = () => void queryClient.invalidateQueries({ queryKey: [CLI_TOOL_QUERY_KEY] })
  const scanning = detailQuery.isFetching

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="flex h-6 items-center gap-1.5 text-[13px]">
          <Link to="/cli-tools" className={BACK_LINK_CLASS}>
            <IconArrowLeft className="size-3.5" aria-hidden />
            CLI tools
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            /
          </span>
          <span className="text-foreground" aria-current="page">
            {tool.name}
          </span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-4 py-1">
          <div className="flex min-w-0 items-center gap-3">
            <ToolLogo id={tool.id} className="size-10 rounded-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] leading-7 font-semibold tracking-tight text-foreground">
                  {tool.name}
                </h1>
                {detail ? (
                  <span
                    className={cn(
                      'inline-flex h-5 items-center rounded-sm border px-1.5 text-[11px] font-medium',
                      detail.installed
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-border bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {detail.installed ? 'Installed' : 'Not installed'}
                  </span>
                ) : (
                  <Skeleton className="h-5 w-20" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <Button variant="outline" disabled={scanning} onClick={rescan}>
            <IconRefresh className={cn(scanning && 'motion-safe:animate-spin')} aria-hidden />
            Rescan
          </Button>
        </div>
      </div>

      <ol className="w-full max-w-[56rem] divide-y divide-border rounded-lg border border-border bg-card">
        <Step n={1} title={`Install ${tool.name}`}>
          {!detail ? (
            <Skeleton className="h-5 w-2/3" />
          ) : detail.installed ? (
            <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
              <IconCircleCheck
                className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <span className="min-w-0 break-all">
                Found at <code className="font-mono text-foreground">{detail.path}</code>
              </span>
            </p>
          ) : (
            <>
              <p className="flex items-start gap-2 text-[13px] text-foreground">
                <IconAlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                Not detected here. Install it and rescan, or set it up by hand in step 4.
              </p>
              {tool.install && (
                <ConfigFiles
                  files={[
                    {
                      path: 'install',
                      display_path: 'Shell',
                      label: 'install command',
                      partial: false,
                      content: tool.install,
                    },
                  ]}
                />
              )}
            </>
          )}
        </Step>

        <Step n={2} title="Choose endpoint, key and model">
          <div className="flex w-full max-w-xl flex-col gap-5">
            <Field
              label="Endpoint URL"
              badge="Required"
              help="This gateway's address."
              value={baseUrl}
              onChange={setBaseUrl}
              mono
              type="url"
            />

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium text-foreground">API key</span>
              <SegmentedControl
                aria-label="API key"
                options={KEY_MODES}
                value={keyMode}
                onChange={setKeyMode}
                className="self-start"
              />
              {keyMode === 'create' ? (
                <Field
                  label="New key name"
                  hideLabel
                  help="A dedicated key is created when you write the config, so you can revoke this tool on its own."
                  value={keyName}
                  onChange={setKeyName}
                />
              ) : (
                <Field
                  label="API key"
                  hideLabel
                  help="A full key of this gateway. Keys are shown only when they are created or rotated."
                  value={pastedKey}
                  onChange={setPastedKey}
                  placeholder="sk_tr_…"
                  mono
                  type="password"
                  autoComplete="off"
                />
              )}
            </div>

            <Field
              label="Default model"
              badge={modelRequired ? 'Required' : 'Optional'}
              help={
                modelRequired
                  ? `${tool.name} needs a model to send requests. Use a provider/model id or chain:<name>.`
                  : "Leave empty to keep the tool's own default model."
              }
              value={model}
              onChange={setModel}
              placeholder="provider/model-id or chain:my-chain"
              mono
            />
          </div>
        </Step>

        <Step
          n={3}
          title="Write the config"
          description={
            detail ? (
              `Updates ${detail.files.map((f) => f.path).join(', ')}`
            ) : (
              <Skeleton className="mt-0.5 h-5 w-1/2" />
            )
          }
        >
          <div className="flex flex-col items-start gap-2">
            <Button disabled={missing !== null || applyMutation.isPending} onClick={handleWrite}>
              <IconFileCode aria-hidden />
              {applyMutation.isPending ? 'Writing…' : 'Write config'}
            </Button>
            {missing && <p className="text-xs text-muted-foreground">{missing}</p>}
            {written && (
              <p role="status" className="flex items-start gap-2 text-xs text-foreground">
                <IconCircleCheck
                  className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                <span className="min-w-0 break-all">{written}</span>
              </p>
            )}
          </div>
        </Step>

        <li className="flex gap-3 px-5 pt-4 pb-[17px]">
          <StepNumber n={4} />
          <details open className="group min-w-0 flex-1">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 text-[13px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <h2>Or set it up by hand</h2>
              <IconChevronRight
                className="size-4 text-muted-foreground group-open:rotate-90 motion-safe:transition-[rotate] motion-safe:duration-150"
                aria-hidden
              />
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-[13px] text-muted-foreground">{tool.manual}</p>
              <p className="text-[13px] text-muted-foreground">
                Replace <code className="font-mono">sk_tr_YOUR_API_KEY</code> with a full API key
                from{' '}
                <Link to="/keys" className="text-foreground underline underline-offset-2">
                  API keys
                </Link>
                .
              </p>
              {detailQuery.isError ? (
                <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                  <span>
                    Couldn't load the config preview: {axiosErrorMessage(detailQuery.error)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void detailQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : detail ? (
                <>
                  <ConfigFiles files={detail.files} />
                  <EnvTable vars={detail.env} />
                </>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </div>
          </details>
        </li>
      </ol>
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground tabular-nums"
      aria-hidden
    >
      {n}
    </span>
  )
}

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number
  title: string
  /** Muted line that sits right under the title, e.g. the files a step writes. */
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3 px-5 pt-4 pb-[17px]">
      <StepNumber n={n} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="pt-1">
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {description && (
            <div className="mt-0.5 text-[12.5px] break-all text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {children}
      </div>
    </li>
  )
}

interface FieldProps {
  label: string
  hideLabel?: boolean
  badge?: string
  help: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
  type?: string
  autoComplete?: string
}

function Field({
  label,
  hideLabel,
  badge,
  help,
  value,
  onChange,
  placeholder,
  mono,
  type = 'text',
  autoComplete,
}: FieldProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id} className="text-[13px]">
            {label}
          </Label>
          {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
        </div>
      )}
      <Input
        id={id}
        aria-label={hideLabel ? label : undefined}
        aria-describedby={`${id}-help`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
        className={cn(mono && 'font-mono')}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {help}
      </p>
    </div>
  )
}
