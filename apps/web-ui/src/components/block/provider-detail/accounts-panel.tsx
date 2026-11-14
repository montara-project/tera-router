import type { ColumnDef } from '@tanstack/react-table'

import {
  IconCircleCheck,
  IconDots,
  IconDownload,
  IconKey,
  IconMinus,
  IconPlaylistAdd,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import ReactTable, { features } from '@/components/block/common/react-table'
import SectionCardPanel from '@/components/block/common/section-card-panel'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import {
  AccountSearchBar,
  AccountListError,
  AccountSearchEmpty,
  useProviderAccounts,
} from '@/components/block/provider-detail/account-search'
import AccountsExportDialog from '@/components/block/provider-detail/accounts-export-dialog'
import AccountsImportDialog from '@/components/block/provider-detail/accounts-import-dialog'
import BulkAddKeysDialog from '@/components/block/provider-detail/bulk-add-keys-dialog'
import { OAUTH_ONLY_PROVIDERS } from '@/components/block/providers/catalog-connect'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { queries } from '@/lib/api/queries'
import { services } from '@/lib/api/services'
import { readJsonObject } from '@/lib/file'

/** The pager never offers fewer than 10 rows. */
const PAGE_SIZES = [10, 25, 50, 100]

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

/** The `format` field of a per-provider accounts export file. */
const ACCOUNTS_BACKUP_FORMAT = 'tera-router.accounts'
/** IDrouter's per-provider export: same envelope role, different discriminator.
 * The server converts it on import, so the dashboard only has to recognise it. */
const IDROUTER_BACKUP_KIND = 'account-portfolio'

/**
 * The provider's credential list: pagination, per-account connection tests,
 * deletion, bulk add, and moving the accounts between installs (export /
 * import) all live here. The panel reads its own page from the server, which
 * also scopes it to the provider and applies the search; the parent gets
 * `onChanged` after a change so it can invalidate its query keys.
 */
export default function AccountsPanel({
  canManageKeys,
  provider,
  onAddKey,
  onChanged,
}: {
  canManageKeys: boolean
  provider: { slug: string; name: string }
  onAddKey: () => void
  onChanged: () => Promise<unknown> | void
}) {
  const list = useProviderAccounts({ slug: provider.slug })
  // The provider has no account at all, as opposed to a search matching none.
  const noAccounts = !list.pending && !list.searching && list.total === 0
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [savingPriorityId, setSavingPriorityId] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    backup: Record<string, unknown>
    fileName: string
  } | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const testAccountMutation = useMutation(queries.accounts.test())
  const deleteAccountMutation = useMutation(queries.accounts.delete())
  const toggleAccountMutation = useMutation(queries.accounts.update())

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

  // Every account of the provider is tested, whatever page or search is shown.
  const testAll = async () => {
    setTestingAll(true)
    let accounts: Models.Account[] = []
    try {
      // The list returns at most 1000 accounts a page; read every page.
      for (let offset = 0; ; offset += 1000) {
        const res = await services.accounts.list({ offset, limit: 1000, provider: provider.slug })
        accounts.push(...res.data.data)
        if (accounts.length >= (res.data.metadata.total ?? 0) || res.data.data.length === 0) break
      }
    } catch {
      setTestingAll(false)
      toast.error('Failed to load accounts')
      return
    }
    if (accounts.length === 0) {
      setTestingAll(false)
      toast.info('No accounts to test')
      return
    }
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

  // Check the picked file here so a wrong file is named before the passphrase
  // is asked for; the server repeats both checks.
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const backup = await readJsonObject(file)
      const isTeraRouter = backup.format === ACCOUNTS_BACKUP_FORMAT
      if (!isTeraRouter && backup.kind !== IDROUTER_BACKUP_KIND) {
        toast.error('Not an accounts export', {
          description: `${file.name} was not exported from a provider's accounts.`,
        })
        return
      }
      if (backup.provider !== provider.slug) {
        toast.error('Wrong provider', {
          description: `${file.name} holds ${String(backup.provider)} accounts, not ${provider.slug}.`,
        })
        return
      }
      setPendingImport({ backup, fileName: file.name })
    } catch (error) {
      toast.error((error as Error).message)
    }
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
    if (list.loading) {
      return (
        <div className="space-y-2 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )
    }

    if (list.failed) return <AccountListError list={list} />

    if (noAccounts) {
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
      <ReactTable
        total={list.total}
        data={list.rows}
        pageIndex={list.pageIndex}
        pageSize={list.limit}
        pageSizes={PAGE_SIZES}
        columns={columns}
        tableClassName="min-w-[44rem]"
        emptyMessage={list.searching ? <AccountSearchEmpty search={list} /> : undefined}
      />
    )
  }

  const columns: ColumnDef<typeof features, Models.Account, unknown>[] = [
    {
      id: 'account',
      header: 'Account',
      meta: { cellClassName: 'max-w-0' },
      cell: ({ row }) => {
        const account = row.original
        const name = account.label || 'API key'
        return (
          <>
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
          </>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <AccountStatusPill account={row.original} />,
    },
    {
      id: 'priority',
      header: () => (
        <>
          Priority <span className="font-normal">· lower runs first</span>
        </>
      ),
      cell: ({ row }) => {
        const account = row.original
        const name = account.label || 'API key'
        const saving = savingPriorityId === account.id
        return (
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
        )
      },
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: ({ row }) => (
        <Switch
          checked={!row.original.disabled}
          disabled={togglingId === row.original.id}
          onCheckedChange={() => toggleAccount(row.original)}
          aria-label={`${row.original.label || 'API key'} enabled`}
        />
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      meta: { headerClassName: 'w-24' },
      cell: ({ row }) => {
        const account = row.original
        const name = account.label || 'API key'
        return (
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
        )
      },
    },
  ]

  return (
    <>
      <SectionCardPanel
        icon={IconKey}
        title={
          <>
            Accounts
            <span className="font-normal text-muted-foreground">
              {list.total} {list.total === 1 ? 'account' : 'accounts'}
            </span>
          </>
        }
        toolbar={
          <div className="flex items-center gap-2">
            {noAccounts ? null : <AccountSearchBar search={list} />}
            <Button
              size="sm"
              variant="outline"
              disabled={testingAll || noAccounts}
              onClick={testAll}
            >
              {testingAll ? <IconRefresh className="animate-spin" /> : <IconCircleCheck />}
              Test all
            </Button>
            {canManageKeys ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-2"
                    aria-label="More account actions"
                  >
                    <IconDots />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  {OAUTH_ONLY_PROVIDERS[provider.slug] ? null : (
                    <DropdownMenuItem onClick={() => setBulkOpen(true)}>
                      <IconPlaylistAdd />
                      Bulk add keys
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => importInput.current?.click()}>
                    <IconUpload />
                    Import accounts
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={noAccounts} onClick={() => setExportOpen(true)}>
                    <IconDownload />
                    Export accounts
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      >
        {renderAccounts()}
      </SectionCardPanel>

      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      <BulkAddKeysDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        provider={provider}
        onSuccess={onChanged}
      />
      <AccountsExportDialog open={exportOpen} onOpenChange={setExportOpen} provider={provider} />
      <AccountsImportDialog
        backup={pendingImport?.backup ?? null}
        fileName={pendingImport?.fileName ?? ''}
        provider={provider}
        onClose={() => setPendingImport(null)}
      />

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
