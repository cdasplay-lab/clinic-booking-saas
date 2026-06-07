"use client"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

interface StatusFilterProps {
  options: { value: string; label: string }[]
}

export function StatusFilter({ options }: StatusFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("status") || ""

  function setStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set("status", value)
    else params.delete("status")
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => setStatus("")}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
          !current ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        الكل
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setStatus(o.value)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            current === o.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
