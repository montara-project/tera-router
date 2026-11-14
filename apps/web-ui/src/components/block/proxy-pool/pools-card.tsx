import {
  IconDots,
  IconPencil,
  IconPlayerPlay,
  IconRefresh,
  IconRouteAltLeft,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { EditProxyPoolForm } from '@/components/block/proxy-pool/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatTimeAgo } from '@/lib/date'
import { cn, selectAllState } from '@/lib/utils'

type Reach = 'untested' | 'reachable' | 'unreachable'

/** The last probe's outcome; status is only meaningful once a probe ran. */
const reachOf = (pool: Models.ProxyPool): Reach =>
  !pool.tested_at ? 'untested' : pool.status === 'active' ? 'reachable' : 'unreachable'

const REACH: Record<Reach, { label: string; className: string }> = {
  untested: { label: 'Untested', className: 'border-border bg-muted text-muted-foreground' },
  reachable: {
    label: 'Reachable',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  unreachable: {
    label: 'Unreachable',
    className: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  },
}

/** Hides credentials in `scheme://user:pass@host` so the list never shows them. */
export function maskProxyUrl(url: string) {
  return url.replace(/^([a-z0-9+.-]+:\/\/)[^@/]*@/i, '$1••••@')
}

/** http, https, socks5 or relay, from the URL scheme. */
const schemeOf = (url: string) => {
  const scheme = url.match(/^([a-z0-9+.-]+):\/\//i)?.[1]?.toLowerCase() ?? 'http'
  return scheme.startsWith('relay') ? 'relay' : scheme
}

export default function PoolsCard({
  pools,
  selected,
  onToggleAll,
  onToggleOne,
  healthCheckPending,
  onHealthCheck,
  onDeleteSelected,
}: {
  pools: Models.ProxyPool[]
  selected: Record<string, boolean>
  onToggleAll: (checked: boolean) => void
  onToggleOne: (id: string) => void
  healthCheckPending: boolean
  onHealthCheck: () => void
  onDeleteSelected: () => void
}) {
  const allSelected = pools.length > 0 && pools.every((pool) => selected[pool.id])
  const someSelected = pools.some((pool) => selected[pool.id])
  const reachable = pools.filter((p) => reachOf(p) === 'reachable').length
  const untested = pools.filter((p) => reachOf(p) === 'untested').length

  const figure = (n: number, noun: string) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-medium text-foreground tabular-nums">{n}</span>
      {noun}
    </span>
  )

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2.5 text-[13px] font-semibold">
          <IconRouteAltLeft className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
          Pools
        </h2>
        <p className="flex flex-1 flex-wrap gap-4 text-[12.5px] text-muted-foreground">
          {figure(pools.length, pools.length === 1 ? 'pool' : 'pools')}
          {figure(reachable, 'reachable')}
          {figure(untested, 'untested')}
        </p>
        <div className="flex gap-2">
          {someSelected ? (
            <Button variant="outline" onClick={onDeleteSelected}>
              <IconTrash />
              Delete selected
            </Button>
          ) : null}
          <Button variant="outline" disabled={healthCheckPending} onClick={onHealthCheck}>
            <IconRefresh className={cn(healthCheckPending && 'motion-safe:animate-spin')} />
            Test all
          </Button>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[58rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="w-10 py-2 pr-1 pl-3">
                <Checkbox
                  aria-label="Select all pools"
                  checked={selectAllState(allSelected, someSelected)}
                  onCheckedChange={(value) => onToggleAll(value === true)}
                />
              </th>
              <th className="w-[13%] px-2 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Proxy URL</th>
              <th className="w-[16%] px-4 py-2 text-left font-medium">Status</th>
              <th className="w-[16%] px-4 py-2 text-left font-medium">Used by</th>
              <th className="w-28 px-4 py-2 text-left font-medium">Enabled</th>
              <th className="w-12 px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pools.map((pool) => (
              <PoolRow
                key={pool.id}
                pool={pool}
                accounts={pool.accounts}
                selected={Boolean(selected[pool.id])}
                onToggle={() => onToggleOne(pool.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PoolRow({
  pool,
  accounts,
  selected,
  onToggle,
}: {
  pool: Models.ProxyPool
  accounts: number
  selected: boolean
  onToggle: () => void
}) {
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const testMutation = useMutation(queries.proxyPools.test())
  const updateMutation = useMutation(queries.proxyPools.update())
  const deleteMutation = useMutation(queries.proxyPools.delete())
  const reach = REACH[reachOf(pool)]

  const handleTest = async () => {
    try {
      const res = await testMutation.mutateAsync(pool.id)
      if (res.data.status === 'active') toast.success(`${pool.name} is reachable`)
      else toast.error(`${pool.name} is unreachable`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleEnabled = async (enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({
        id: pool.id,
        reqBody: {
          name: pool.name,
          url: pool.url,
          label: pool.label || undefined,
          bypass: pool.bypass,
          enabled,
          strict: pool.strict,
        },
      })
      toast.success(`${pool.name} ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(pool.id)
      toast.success('Proxy pool deleted')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-1 pl-3 align-top">
        <Checkbox
          aria-label={`Select ${pool.name}`}
          checked={selected}
          onCheckedChange={onToggle}
        />
      </td>
      <td className="max-w-0 px-2 py-2.5">
        <button
          type="button"
          onClick={() => setOpenEdit(true)}
          className="block max-w-full truncate rounded-sm text-left font-medium hover:underline"
          title={pool.name}
        >
          {pool.name}
        </button>
        <span className="mt-1 inline-flex h-5 items-center gap-1 rounded-sm border border-border bg-muted px-[7px] text-[11.5px] font-medium text-muted-foreground">
          <IconWorld className="size-3" aria-hidden />
          {schemeOf(pool.url)}
        </span>
      </td>
      <td className="max-w-0 px-4 py-2.5">
        <code className="block truncate font-mono text-[12.5px]" title={maskProxyUrl(pool.url)}>
          {maskProxyUrl(pool.url)}
        </code>
        {pool.bypass ? (
          <span className="block truncate text-xs text-muted-foreground" title={pool.bypass}>
            Bypass: {pool.bypass.split(',').join(', ')}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'inline-flex h-5 items-center rounded-sm border px-[7px] text-[11.5px] font-medium',
            reach.className
          )}
        >
          {reach.label}
        </span>
        {pool.tested_at ? (
          <span className="block text-xs text-muted-foreground">
            Tested {formatTimeAgo(pool.tested_at)}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {accounts ? `${accounts} ${accounts === 1 ? 'account' : 'accounts'}` : 'No accounts'}
      </td>
      <td className="px-4 py-2.5">
        <Switch
          aria-label={`${pool.name} enabled`}
          checked={pool.enabled}
          disabled={updateMutation.isPending}
          onCheckedChange={(on) => void handleEnabled(on)}
        />
      </td>
      <td className="px-2 py-2.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${pool.name}`}
            >
              <IconDots className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem disabled={testMutation.isPending} onClick={() => void handleTest()}>
              <IconPlayerPlay />
              Test
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenEdit(true)}>
              <IconPencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setOpenDelete(true)}>
              <IconTrash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <EditProxyPoolForm pool={pool} open={openEdit} onOpenChange={setOpenEdit} />
        <SimpleAlertDialog
          confirmText="Delete"
          description={`Proxy pool "${pool.name}" will be permanently deleted. Accounts bound to it connect directly.`}
          onConfirm={handleDelete}
          onOpenChange={setOpenDelete}
          open={openDelete}
          title="Delete this proxy pool?"
          variant="destructive"
        />
      </td>
    </tr>
  )
}
