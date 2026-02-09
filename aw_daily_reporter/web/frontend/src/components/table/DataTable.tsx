"use client"

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Columns,
  Search,
} from "lucide-react"
import { useMemo, useState } from "react"

interface DataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  pageSize?: number
  enableSearch?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  onRowClick?: (row: TData) => void
}

export default function DataTable<TData>({
  data,
  columns,
  pageSize = 20,
  enableSearch = true,
  enableColumnVisibility = true,
  enablePagination = true,
  onRowClick,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  })

  const allColumns = useMemo(() => table.getAllLeafColumns(), [table])

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-3">
        {enableSearch && (
          <div className="relative flex-1 max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search..."
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-300 transition-all"
            />
          </div>
        )}

        {enableColumnVisibility && (
          <details className="relative">
            <summary className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white/60 hover:bg-white/80 transition-colors cursor-pointer list-none">
              <Columns size={16} />
              Columns
            </summary>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-2">
              {allColumns.map((column) => (
                <label
                  key={column.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={(e) => column.toggleVisibility(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {column.id}
                </label>
              ))}
            </div>
          </details>
        )}

        <div className="ml-auto text-sm text-slate-500">
          {table.getFilteredRowModel().rows.length} results
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-linear-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className={`flex items-center gap-1 ${
                            header.column.getCanSort()
                              ? "cursor-pointer hover:text-indigo-600 transition-colors"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getCanSort() && (
                            <span className="text-slate-400">
                              {{
                                asc: <ChevronUp size={14} />,
                                desc: <ChevronDown size={14} />,
                              }[header.column.getIsSorted() as string] ?? (
                                <ChevronsUpDown size={14} />
                              )}
                            </span>
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-indigo-50/40 transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {enablePagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
