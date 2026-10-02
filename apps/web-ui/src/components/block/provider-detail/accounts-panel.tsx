import { IconCircleCheck, IconKey, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge, BadgeDot } from '@/components/ui/badge'
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { queries } from '@/lib/api/queries'
import { services } from '@/lib/api/services'

const PAGE_SIZE = 5

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

  const testAccountMutation = useMutation(queries.accounts.test())
  const deleteAccountMutation = useMutation(queries.accounts.delete())
  const toggleAccountMutation = useMutation(queries.accounts.update())

  const activeAccounts = accounts.filter(
    (account) => !account.disabled && account.status === 'active'
  ).length
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

  return (
    <>
      <Card className="bg-background">
        <CardHeader className="h-20">
          <CardHeading>
            <CardTitle>Account routing</CardTitle>
            <CardDescription>
              Credentials available to this provider and the order used for routing.
            </CardDescription>
          </CardHeading>
          <CardToolbar>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={testingAll} onClick={testAll}>
                {testingAll ? <IconRefresh className="animate-spin" /> : <IconCircleCheck />} Test
                all
              </Button>
              {canManageKeys ? (
                <Button size="sm" variant="outline" onClick={onAddKey}>
                  <IconPlus /> Import keys
                </Button>
              ) : null}
            </div>
          </CardToolbar>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {activeAccounts} active
            </p>
            <p className="text-xs text-muted-foreground">
              Priority determines first-choice routing.
            </p>
          </div>
          {loading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconKey />
                </EmptyMedia>
                <EmptyTitle>No API keys yet</EmptyTitle>
                <EmptyDescription>
                  Add a credential to enable requests through this provider.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-175">
                <div className="border-b border-border px-5 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {accounts.length} connected {accounts.length === 1 ? 'account' : 'accounts'}
                  </p>
                </div>
                <div className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr] gap-4 border-b border-border px-5 py-3 text-xs text-muted-foreground">
                  <span>Account</span>
                  <span>Auth</span>
                  <span>Priority</span>
                  <span>Connection</span>
                  <span className="text-right">Actions</span>
                </div>
                {visibleAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="grid grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr] items-center gap-4 border-b border-border/60 px-5 py-3 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{account.label || 'API key'}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {account.key_fingerprint || 'Credential stored securely'}
                      </p>
                    </div>
                    <span className="text-sm">
                      {account.auth_kind === 'api_key' ? 'API key' : account.auth_kind}
                    </span>
                    <span className="font-mono text-sm">{account.priority}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          account.disabled || account.status !== 'active' ? 'secondary' : 'success'
                        }
                        appearance="light"
                        size="sm"
                      >
                        <BadgeDot />
                        {account.disabled || account.status !== 'active'
                          ? 'Disabled'
                          : 'Direct connection'}
                      </Badge>
                      <Switch
                        size="sm"
                        checked={!account.disabled}
                        disabled={togglingId === account.id}
                        onCheckedChange={() => toggleAccount(account)}
                        aria-label={`${account.disabled ? 'Enable' : 'Disable'} ${account.label || 'API key'}`}
                      />
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Test ${account.label}`}
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
                        aria-label={`Delete ${account.label}`}
                        onClick={() => setDeleteAccountId(account.id)}
                      >
                        <IconTrash />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {accounts.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
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
        </CardContent>
      </Card>

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
