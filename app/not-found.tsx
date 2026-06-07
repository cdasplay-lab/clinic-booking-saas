import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BookOpen, Home, ArrowRight } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen className="h-7 w-7 text-blue-600" />
          <span className="text-2xl font-bold text-blue-600">HesabPro</span>
        </div>

        <div className="text-8xl font-black text-blue-200 mb-4 select-none">404</div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">الصفحة غير موجودة</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          الرابط الذي تبحث عنه غير موجود أو ربما تم نقله. تحقق من الرابط أو عد إلى لوحة التحكم.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 ml-1" />
              لوحة التحكم
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="javascript:history.back()">
              <ArrowRight className="h-4 w-4 ml-1" />
              الصفحة السابقة
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
