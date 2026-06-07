import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" dir="rtl">
      {children}
    </div>
  )
}
