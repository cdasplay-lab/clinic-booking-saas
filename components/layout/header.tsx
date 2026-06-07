"use client"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, Settings, User, Building2, ChevronDown, Check } from "lucide-react"
import Link from "next/link"
import NotificationBell from "@/components/layout/notification-bell"
import { getCountry } from "@/lib/countries"

interface OrgInfo {
  id: string
  name: string
  country: string
  plan: string
  role: string
}

export default function Header({ user, org, orgs = [] }: { user: any; org: any; orgs?: OrgInfo[] }) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)
  const country = getCountry(org.country || "SA")

  async function switchOrg(orgId: string) {
    if (orgId === org.id || switching) return
    setSwitching(true)
    const res = await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    })
    if (res.ok) router.refresh()
    else setSwitching(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between">
      {/* Left: org name (offset on mobile to avoid hamburger overlap) */}
      <div className="pr-12 md:pr-0">
        {orgs.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 group text-right focus:outline-none"
                disabled={switching}
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                    {org.name}
                  </p>
                  <p className="text-xs text-gray-400">{country.flag} {country.currencySymbol}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-xs text-gray-400">تبديل الشركة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {orgs.map((o) => {
                const oc = getCountry(o.country || "SA")
                return (
                  <DropdownMenuItem
                    key={o.id}
                    onClick={() => switchOrg(o.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                        {o.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{o.name}</p>
                        <p className="text-xs text-gray-400">{oc.flag} {oc.currencyAr}</p>
                      </div>
                    </div>
                    {o.id === org.id && <Check className="h-4 w-4 text-blue-600" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-900">{org.name}</p>
            <p className="text-xs text-gray-400">{country.flag} {country.currencySymbol}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 md:px-3">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden md:inline">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" /> الملف الشخصي
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> الإعدادات
              </Link>
            </DropdownMenuItem>
            {orgs.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings/users" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> إدارة الفريق
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
