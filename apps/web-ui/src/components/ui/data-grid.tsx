'use client'

import {
  type ColumnFiltersState,
  type ReactTable,
  type RowData,
  type SortingState,
} from '@tanstack/react-table'
import { createContext, type ReactNode, useContext } from 'react'

import { cn } from '@/lib/utils'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<
    TFeatures extends import('@tanstack/react-table').TableFeatures,
    TData extends RowData,
    TValue extends import('@tanstack/react-table').CellData =
      import('@tanstack/react-table').CellData,
  > {
    headerTitle?: string
    headerClassName?: string
    cellClassName?: string
    skeleton?: ReactNode
    expandedContent?: (row: TData) => ReactNode
  }
}

export type DataGridApiFetchParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  filters?: ColumnFiltersState
  searchQuery?: string
}

export type DataGridApiResponse<T> = {
  data: T[]
  empty: boolean
  pagination: {
    total: number
    page: number
  }
}

export interface DataGridContextProps<TData extends RowData> {
  props: DataGridProps<TData>
  table: ReactTable<any, TData>
  recordCount: number
  isLoading: boolean
}

export type DataGridRequestParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  columnFilters?: ColumnFiltersState
}

export interface DataGridProps<TData extends RowData> {
  className?: string
  table?: ReactTable<any, TData>
  recordCount: number
  children?: ReactNode
  onRowClick?: (row: TData) => void
  isLoading?: boolean
  loadingMode?: 'skeleton' | 'spinner'
  loadingMessage?: ReactNode | string
  emptyMessage?: ReactNode | string
  tableLayout?: {
    dense?: boolean
    cellBorder?: boolean
    rowBorder?: boolean
    rowRounded?: boolean
    stripped?: boolean
    headerBackground?: boolean
    headerBorder?: boolean
    headerSticky?: boolean
    width?: 'auto' | 'fixed'
    columnsVisibility?: boolean
    columnsResizable?: boolean
    columnsPinnable?: boolean
    columnsMovable?: boolean
    columnsDraggable?: boolean
    rowsDraggable?: boolean
  }
  tableClassNames?: {
    base?: string
    header?: string
    headerRow?: string
    headerSticky?: string
    body?: string
    bodyRow?: string
    footer?: string
    edgeCell?: string
  }
}

const DataGridContext = createContext<DataGridContextProps<any> | undefined>(undefined)

function useDataGrid() {
  const context = useContext(DataGridContext)
  if (!context) {
    throw new Error('useDataGrid must be used within a DataGridProvider')
  }
  return context
}

function DataGridProvider<TData extends RowData>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: ReactTable<any, TData> }) {
  return (
    <DataGridContext.Provider
      value={{
        props,
        table: table as ReactTable<any, any>,
        recordCount: props.recordCount,
        isLoading: props.isLoading || false,
      }}
    >
      {children}
    </DataGridContext.Provider>
  )
}

function DataGrid<TData extends RowData>({ children, table, ...props }: DataGridProps<TData>) {
  const defaultProps: Partial<DataGridProps<TData>> = {
    loadingMode: 'skeleton',
    tableLayout: {
      dense: false,
      cellBorder: false,
      rowBorder: true,
      rowRounded: false,
      stripped: false,
      headerSticky: false,
      headerBackground: true,
      headerBorder: true,
      width: 'fixed',
      columnsVisibility: false,
      columnsResizable: false,
      columnsPinnable: false,
      columnsMovable: false,
      columnsDraggable: false,
      rowsDraggable: false,
    },
    tableClassNames: {
      base: '',
      header: '',
      headerRow: '',
      headerSticky: 'sticky top-0 z-10 bg-background/90 backdrop-blur-xs',
      body: '',
      bodyRow: '',
      footer: '',
      edgeCell: '',
    },
  }

  const mergedProps: DataGridProps<TData> = {
    ...defaultProps,
    ...props,
    tableLayout: {
      ...defaultProps.tableLayout,
      ...props.tableLayout,
    },
    tableClassNames: {
      ...defaultProps.tableClassNames,
      ...props.tableClassNames,
    },
  }

  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop')
  }

  return (
    <DataGridProvider table={table} {...mergedProps}>
      {children}
    </DataGridProvider>
  )
}

function DataGridContainer({
  children,
  className,
  border = true,
}: {
  children: ReactNode
  className?: string
  border?: boolean
}) {
  return (
    <div
      data-slot="data-grid"
      className={cn('grid w-full', border && 'border-border rounded-lg border', className)}
    >
      {children}
    </div>
  )
}

export { DataGrid, DataGridContainer, DataGridProvider, useDataGrid }
