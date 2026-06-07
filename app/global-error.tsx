"use client"
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">حدث خطأ غير متوقع</h1>
        <p className="text-gray-500 max-w-md">
          نعتذر عن هذا الخطأ. تم تسجيله تلقائياً وسيقوم فريقنا بمراجعته.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">رقم الخطأ: {error.digest}</p>
        )}
        <Button onClick={reset}>إعادة المحاولة</Button>
      </body>
    </html>
  )
}
