import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, User } from "lucide-react"
import Link from "next/link"
import ProfileForm from "@/components/settings/profile-form"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, twoFactorEnabled: true },
  })
  if (!user) redirect("/login")

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings">
            <ArrowRight className="h-4 w-4 ml-1" /> الإعدادات
          </Link>
        </Button>
        <span className="text-gray-300">/</span>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          <h1 className="text-xl font-bold">الملف الشخصي</h1>
        </div>
      </div>

      <ProfileForm user={{ id: user.id, name: user.name || "", email: user.email }} />
    </div>
  )
}
