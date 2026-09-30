import { useQueryState } from 'nuqs'

interface UsePaginationQueryProps {
  offset?: number
  limit?: number
}

const parseParam = (value: string | null, fallback: number) => {
  if (value === null) return fallback
  const n = Number.parseInt(value, 10)
  // Garbage like ?page=abc must fall back, not produce a NaN offset.
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function usePaginationQuery({ offset, limit }: UsePaginationQueryProps = {}) {
  const [queryPage] = useQueryState('page')
  const [queryPageSize] = useQueryState('pageSize')

  const pageIndex = parseParam(queryPage, offset ?? 0)
  const pageSize = parseParam(queryPageSize, limit ?? 10)

  const calculatedOffset = pageIndex * pageSize

  return { offset: offset ?? calculatedOffset, limit: limit ?? pageSize, pageIndex }
}
