/* eslint-disable react-hooks/incompatible-library */

'use client'

import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSort,
  type ColumnVisibilityState,
  type FilterFnOption,
  type PaginationState,
  type ReactTable,
  type RowData,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'

import { DataGrid, DataGridContainer } from '@/components/ui/data-grid'
import { DataGridPagination } from '@/components/ui/data-grid-pagination'
import { DataGridTable } from '@/components/ui/data-grid-table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

export const features = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

interface ReactTableProps<T extends RowData> {
  columns: ColumnDef<typeof features, T, unknown>[]
  data: T[]
  pageSize?: number
  pageIndex?: number
  total: number
  columnSort?: ColumnSort[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  globalFilterFn?: FilterFnOption<typeof features, T>
  getRowId?: (row: T) => string
}

export default function ReactTable<T extends RowData>({
  columns,
  data,
  pageSize = 10,
  pageIndex = 0,
  total,
  columnSort = [],
  globalFilterFn,
  getRowId,
  onPageChange,
  onPageSizeChange,
}: ReactTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(columnSort)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex,
    pageSize,
  })
  const [prevPageProps, setPrevPageProps] = useState({ pageIndex, pageSize })

  // Sync pagination state when the controlled page props change.
  if (prevPageProps.pageIndex !== pageIndex || prevPageProps.pageSize !== pageSize) {
    setPrevPageProps({ pageIndex, pageSize })
    setPagination({ pageIndex, pageSize })
  }

  const table = useTable({
    features,
    columns,
    data,
    pageCount: Math.ceil(total / pagination.pageSize),
    getRowId: getRowId ? getRowId : (row: T) => String((row as Record<string, unknown>).id),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    globalFilterFn,
    columnResizeMode: 'onChange',
    manualPagination: true,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  return (
    <DataGrid
      table={table as unknown as ReactTable<any, any>}
      recordCount={total}
      tableLayout={{
        columnsVisibility: true,
        columnsResizable: true,
        columnsPinnable: true,
        columnsMovable: true,
      }}
      tableClassNames={{
        edgeCell: 'px-5',
      }}
    >
      <div className="w-full space-y-2.5">
        <DataGridContainer>
          <ScrollArea>
            <DataGridTable />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DataGridContainer>
        <DataGridPagination
          total={total}
          pageSize={pagination.pageSize}
          pageIndex={pagination.pageIndex}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </DataGrid>
  )
}
