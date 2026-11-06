import {
  IconCircleCheck,
  IconKey,
  IconMinus,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import DashboardPanel from '@/components/block/dashboard/dashboard-panel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { queries } from '@/lib/api/queries'
import { services } from '@/lib/api/services'

const PAGE_SIZE = 10

const AUTH_LABEL: Record<string, string> = { api_key: 'API key', oauth: 'OAuth', none: 'No auth' }

/** Status pill: active and enabled reads green, anything else muted with its reason. */
function AccountStatusPill({ account }: { account: Models.Account }) {
  const active = !account.disabled && account.status === 'active'
  const label = account.disabled
    ? 'Disabled'
    : active
      ? 'Active'
      : account.status.charAt(0).toUpperCase() + account.status.slice(1).replace(/_/g, ' ')
  return (
    <span
      className={
        active
          ? 'rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-700 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-400'
          : 'rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground'
      }
    >
      {label}
    </span>
  )
}

/**
 * The provider's credential list: pagination, per-account connection tests,
 * and deletion all live here. The parent owns filtering (accounts already
 * scoped to this provider) and gets `onChanged` after a deletion so it can
 * invalidate its query keys.
 */
export default function AccountsPanel({
  accounts,
  loading,
  canManageKeys,
  onAddKey,
  onChanged,
}: {
  accounts: Models.Account[]
  loading: boolean
  canManageKeys: boolean
  onAddKey: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const [accountPage, setAccountPage] = useState(1)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [savingPriorityId, setSavingPriorityId] = useState<string | null>(null)

  const testAccountMutation = useMutation(queries.accounts.test())
  const deleteAccountMutation = useMutation(queries.accounts.delete())
  const toggleAccountMutation = useMutation(queries.accounts.update())

  const visibleAccounts = accounts.slice((accountPage - 1) * PAGE_SIZE, accountPage * PAGE_SIZE)
  const accountPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE))

  const testAccount = async (id: string) => {
    setTestingId(id)
    try {
      const result = await testAccountMutation.mutateAsync(id)
      toast[result.data.ok ? 'success' : 'error'](
        result.data.ok
          ? `Connection successful · ${result.data.latency_ms} ms`
          : result.data.detail || 'Connection test failed'
      )
    } catch {
      toast.error('Connection test failed')
    } finally {
      setTestingId(null)
    }
  }

  const testAll = async () => {
    if (accounts.length === 0) {
      toast.info('No accounts to test')
      return
    }
    setTestingAll(true)
    let ok = 0
    for (const account of accounts) {
      try {
        const result = await services.accounts.test(account.id)
        if (result.data.data.ok) ok += 1
      } catch {
        // counted as failure below
      }
    }
    setTestingAll(false)
    if (ok === accounts.length) toast.success(`All ${ok} accounts reachable`)
    else toast.warning(`${ok} of ${accounts.length} accounts reachable`)
  }

  const removeAccount = async (id: string) => {
    try {
      await deleteAccountMutation.mutateAsync(id)
      await onChanged()
      toast.success('Account removed')
      setDeleteAccountId(null)
    } catch {
      toast.error('Failed to remove account')
    }
  }

  const toggleAccount = async (account: Models.Account) => {
    setTogglingId(account.id)
    try {
      // the update endpoint validates provider as required even for patches
      await toggleAccountMutation.mutateAsync({
        id: account.id,
        provider: account.provider,
        disabled: !account.disabled,
      })
      await onChanged()
      toast.success(account.disabled ? 'Account enabled' : 'Account disabled')
    } catch {
      toast.error('Failed to update account')
    } finally {
      setTogglingId(null)
    }
  }

  // Lower priority is tried first; the server reads 0 as "unchanged", so 1 is the floor.
  const setPriority = async (account: Models.Account, priority: number) => {
    if (priority < 1 || priority === account.priority) return
    setSavingPriorityId(account.id)
    try {
      await toggleAccountMutation.mutateAsync({
        id: account.id,
        provider: account.provider,
        priority,
      })
      await onChanged()
    } catch {
      toast.error('Failed to update priority')
    } finally {
      setSavingPriorityId(null)
    }
  }

  const renderAccounts = () => {
    if (loading) {
      return (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )
    }

    if (accounts.length === 0) {
      return (
        <EmptyState
          className="py-12"
          icon={IconKey}
          title="No API keys yet"
          description="Add a credential to enable requests through this provider."
          action={
            canManageKeys ? (
              <Button size="sm" onClick={onAddKey}>
                <IconPlus /> Add API key
              </Button>
            ) : null
          }
        />
      )
    }

    return (
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[44rem] text-[13px]">
          <thead className="border-b border-border text-xs text-muted-foreground dark:bg-muted/40">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Account</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">
                Priority <span className="font-normal">· lower runs first</span>
              </th>
              <th className="px-4 py-2 text-left font-medium">Enabled</th>
              <th className="w-24 px-4 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleAccounts.map((account) => {
              const name = account.label || 'API key'
              const saving = savingPriorityId === account.id
              return (
                <tr key={account.id} className="border-b border-border last:border-0">
                  <td className="max-w-0 px-4 py-2.5">
                    <p className="truncate font-medium" title={name}>
                      {name}
                    </p>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={account.key_fingerprint || undefined}
                    >
                      {AUTH_LABEL[account.auth_kind] ?? account.auth_kind}
                      {account.key_fingerprint ? (
                        <span className="font-mono"> · {account.key_fingerprint}</span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <AccountStatusPill account={account} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div
                      role="group"
                      aria-label={`${name} priority`}
                      className="inline-flex h-8 items-center rounded-md border border-input"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-e-none"
                        aria-label={`Raise ${name} priority`}
                        disabled={saving || account.priority <= 1}
                        onClick={() => setPriority(account, account.priority - 1)}
                      >
                        <IconMinus className="size-3.5" />
                      </Button>
                      <span
                        className="w-11 border-x border-input text-center tabular-nums"
                        aria-live="polite"
                      >
                        {account.priority}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-s-none"
                        aria-label={`Lower ${name} priority`}
                        disabled={saving}
                        onClick={() => setPriority(account, account.priority + 1)}
                      >
                        <IconPlus className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Switch
                      checked={!account.disabled}
                      disabled={togglingId === account.id}
                      onCheckedChange={() => toggleAccount(account)}
                      aria-label={`${name} enabled`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Test ${name}`}
                        disabled={testingId === account.id}
                        onClick={() => testAccount(account.id)}
                      >
                        {testingId === account.id ? (
                          <IconRefresh className="animate-spin" />
                        ) : (
                          <IconCircleCheck />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Delete ${name}`}
                        onClick={() => setDeleteAccountId(account.id)}
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <DashboardPanel
        icon={IconKey}
        title={
          <>
            Accounts
            <span className="font-normal text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
            </span>
          </>
        }
        toolbar={
          <Button
            size="sm"
            variant="outline"
            disabled={testingAll || accounts.length === 0}
            onClick={testAll}
          >
            {testingAll ? <IconRefresh className="animate-spin" /> : <IconCircleCheck />}
            Test all
          </Button>
        }
      >
        {renderAccounts()}
        {accounts.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{accounts.length} total</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={accountPage <= 1}
                onClick={() => setAccountPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {accountPage} / {accountPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={accountPage >= accountPages}
                onClick={() => setAccountPage((p) => Math.min(accountPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </DashboardPanel>

      <SimpleAlertDialog
        open={deleteAccountId !== null}
        onOpenChange={(open) => !open && setDeleteAccountId(null)}
        title="Delete API key?"
        description="This permanently removes the selected credential from this provider."
        confirmText="Delete API key"
        onConfirm={() => deleteAccountId && removeAccount(deleteAccountId)}
        variant="destructive"
      />
    </>
  )
}
