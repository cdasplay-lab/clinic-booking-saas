"use client"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Home, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center" dir="rtl">
      <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">حدث خطأ في تحميل هذه الصفحة</h2>
      <p className="text-sm text-gray-500 mb-2 max-w-sm">
        تعذّر تحميل البيانات. تحقق من اتصالك بالإنترنت وحاول مجدداً.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 mb-6 font-mono">رمز الخطأ: {error.digest}</p>
      )}
      <div className="flex items-center gap-3 mt-4">
        <Button onClick={reset} size="sm">
          <RefreshCw className="h-4 w-4 ml-1" />
          حاول مجدداً
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4 ml-1" />
            الرئيسية
          </Link>
        </Button>
      </div>
    </div>
  )
}
