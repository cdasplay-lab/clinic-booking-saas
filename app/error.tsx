"use client"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="flex items-center justify-center gap-2 mb-8">
              <BookOpen className="h-7 w-7 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">HesabPro</span>
            </div>

            <div className="text-6xl mb-4">⚠️</div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">حدث خطأ غير متوقع</h1>
            <p className="text-gray-500 mb-2 text-sm">
              نعتذر عن هذا الخطأ. يمكنك المحاولة مجدداً أو العودة للصفحة الرئيسية.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400 mb-6 font-mono">رمز الخطأ: {error.digest}</p>
            )}

            <div className="flex items-center justify-center gap-3 mt-6">
              <Button onClick={reset}>
                <RefreshCw className="h-4 w-4 ml-1" />
                حاول مجدداً
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <Home className="h-4 w-4 ml-1" />
                  لوحة التحكم
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
