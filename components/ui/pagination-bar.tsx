import Link from "next/link"
import { ChevronRight, ChevronLeft } from "lucide-react"

interface PaginationBarProps {
  page: number
  total: number
  pageSize: number
  baseUrl: string
  searchParams?: Record<string, string>
}

export function PaginationBar({ page, total, pageSize, baseUrl, searchParams = {} }: PaginationBarProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  function buildUrl(p: number) {
    const params = new URLSearchParams({ ...searchParams, page: String(p) })
    return `${baseUrl}?${params.toString()}`
  }

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  // Build visible page numbers
  const pages: (number | "...")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("...")
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-1 py-3">
      <p className="text-sm text-gray-500">
        عرض {start}–{end} من {total.toLocaleString("ar-SA")}
      </p>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={buildUrl(page - 1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="p-1.5 text-gray-300"><ChevronRight className="h-4 w-4" /></span>
        )}

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-gray-400 text-sm">...</span>
          ) : (
            <Link
              key={p}
              href={buildUrl(p as number)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              {p}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link
            href={buildUrl(page + 1)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="p-1.5 text-gray-300"><ChevronLeft className="h-4 w-4" /></span>
        )}
      </div>
    </div>
  )
}
