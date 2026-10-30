import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

/**
 * Client-side paging over an in-memory list. The page is clamped, so a list
 * that shrinks (a new time range) never leaves the table on an empty page.
 */
export function usePagedRows<T>(rows: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1)
  const current = Math.min(page, pageCount)

  return {
    page: current,
    pageCount,
    setPage,
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
  }
}

/**
 * The page numbers to show: all of them when there are few, otherwise the
 * first, the last, and the current page's neighbours, with null marking an
 * ellipsis gap.
 */
export function pageItems(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)

  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)

  const items: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push(null)
    items.push(p)
  })
  return items
}

interface TablePaginationProps {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

/** Table footer: the visible range plus ReUI pagination controls. */
export default function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (total === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row',
        className
      )}
    >
      <p className="text-muted-foreground text-xs tabular-nums">
        Showing {from}–{to} of {total}
      </p>

      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <IconChevronLeft className="size-4" />
              </Button>
            </PaginationItem>

            {pageItems(page, pageCount).map((item, i) =>
              item === null ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <Button
                    variant={item === page ? 'outline' : 'ghost'}
                    mode="icon"
                    size="sm"
                    aria-label={`Page ${item}`}
                    aria-current={item === page ? 'page' : undefined}
                    onClick={() => onPageChange(item)}
                    className="tabular-nums"
                  >
                    {item}
                  </Button>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <Button
                variant="ghost"
                mode="icon"
                size="sm"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => onPageChange(page + 1)}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
