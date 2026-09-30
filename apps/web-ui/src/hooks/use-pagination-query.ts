import { useQueryState } from 'nuqs'

interface UsePaginationQueryProps {
  offset?: number
  limit?: number
}

export function usePaginationQuery({ offset, limit }: UsePaginationQueryProps = {}) {
  const [queryPage] = useQueryState('page')
  const [queryPageSize] = useQueryState('pageSize')

  const pageIndex = queryPage ? parseInt(queryPage) : (offset ?? 0)
  const pageSize = queryPageSize ? parseInt(queryPageSize) : (limit ?? 10)

  const calculatedOffset = pageIndex * pageSize

  return { offset: offset ?? calculatedOffset, limit: limit ?? pageSize, pageIndex }
}
