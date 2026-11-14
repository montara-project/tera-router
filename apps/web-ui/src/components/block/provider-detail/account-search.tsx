import { IconAlertTriangle, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

import type { AccountListDto } from '@/lib/api/dtos/account/schema'
import type { AccountAuthKind } from '@/lib/api/models/account'

import EmptyState from '@/components/block/common/empty-state'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { usePaginationQuery } from '@/hooks/use-pagination-query'
import { queries } from '@/lib/api/queries'

/**
 * One page of a provider's accounts, for a provider tab. The provider scope,
 * the credential kind, the text search and the paging are all parameters of
 * the server query (GET /v1/accounts); nothing is filtered or sliced in the
 * browser. The page lives in ?page / ?pageSize.
 */
export function useProviderAccounts({
  slug,
  authKind,
  defaultLimit,
}: {
  slug: string
  /** Keep one kind of credential, e.g. the OAuth sessions that report a quota. */
  authKind?: AccountAuthKind
  defaultLimit?: number
}) {
  const [value, setValue] = useState('')
  const search = useDebounce({ value: value.trim(), delay: 300 })
  const { offset, limit, pageIndex } = usePaginationQuery({ defaultLimit })
  const [, setPage] = useQueryState('page')

  const query = useQuery({
    ...queries.accounts.list({
      offset,
      limit,
      provider: slug,
      auth_kind: authKind,
      search: search || undefined,
    }),
    enabled: slug !== '',
    // The last page stays on screen while the next page or search is in
    // flight, but never another provider's accounts.
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[2] as AccountListDto | undefined)?.provider === slug
        ? previous
        : undefined,
  })

  // A page past the end has no rows and, with them, no total: it happens when
  // the last row of the last page is removed. Go back to the first page.
  const pastEnd =
    query.isSuccess && !query.isPlaceholderData && pageIndex > 0 && query.data.data.length === 0
  useEffect(() => {
    if (pastEnd) void setPage(null)
  }, [pastEnd, setPage])

  return {
    value,
    /** A new search starts from the first page. */
    onChange: (next: string) => {
      setValue(next)
      void setPage(null)
    },
    /** A search is applied to `rows` and `total`. */
    searching: search !== '',
    rows: query.data?.data ?? [],
    /** Accounts that match on the server, across every page. */
    total: query.data?.metadata.total ?? 0,
    /** True until the page asked for is the one in `rows`. */
    pending: query.isLoading || query.isPlaceholderData || pastEnd,
    loading: query.isLoading,
    /** The list failed to load and there is nothing to show in its place. */
    failed: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
    pageIndex,
    limit,
  }
}

type AccountSearch = Pick<ReturnType<typeof useProviderAccounts>, 'value' | 'onChange'>

/** Shown in place of the rows when the list failed to load. */
export function AccountListError({
  list,
}: {
  list: Pick<ReturnType<typeof useProviderAccounts>, 'retry'>
}) {
  return (
    <EmptyState
      className="py-12"
      icon={IconAlertTriangle}
      title="Couldn't load accounts"
      description="The server did not answer. Try again in a moment."
      action={
        <Button size="sm" variant="outline" onClick={list.retry}>
          Retry
        </Button>
      }
    />
  )
}

/** The search box of a provider tab's toolbar. */
export function AccountSearchBar({ search }: { search: AccountSearch }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputWrapper className="w-full sm:w-72">
        <IconSearch aria-hidden />
        <Input
          type="search"
          aria-label="Search label or key"
          placeholder="Search label or key"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
        />
      </InputWrapper>
    </div>
  )
}

/** Shown in place of the rows when a search matches no account. */
export function AccountSearchEmpty({ search }: { search: AccountSearch }) {
  return (
    <EmptyState
      className="py-12"
      icon={IconSearch}
      title="No accounts match"
      description="Try a shorter label or the last characters of the key."
      action={
        <Button size="sm" variant="outline" onClick={() => search.onChange('')}>
          Clear search
        </Button>
      }
    />
  )
}
