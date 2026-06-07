"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { getCountry } from "@/lib/countries"
import {
  LayoutDashboard, BookOpen, FileText, ShoppingCart, Package,
  CreditCard, Building2, BarChart3, Users, Settings, Bot,
  TrendingUp, Wallet, FileStack, Calculator, Briefcase,
  ChevronDown, ChevronRight, DollarSign, MessageCircle, Shield, FileSpreadsheet, RefreshCw,
  FileX2, FilePlus2, Clock, ClipboardList, Layers, Download
} from "lucide-react"
import { useState } from "react"

const navItems = [
  {
    label: "لوحة التحكم",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "المحاسبة",
    icon: BookOpen,
    children: [
      { label: "دليل الحسابات", href: "/dashboard/accounts", icon: BookOpen },
      { label: "القيود اليومية", href: "/dashboard/journals", icon: FileStack },
      { label: "كشف الحساب", href: "/dashboard/ledger", icon: FileText },
      { label: "مراكز التكلفة", href: "/dashboard/cost-centers", icon: Layers },
    ],
  },
  {
    label: "المبيعات",
    icon: TrendingUp,
    children: [
      { label: "الفواتير", href: "/dashboard/invoices", icon: FileText },
      { label: "عروض الأسعار", href: "/dashboard/quotes", icon: ClipboardList },
      { label: "إشعارات الخصم", href: "/dashboard/credit-notes", icon: FileX2 },
      { label: "فواتير متكررة", href: "/dashboard/recurring", icon: RefreshCw },
      { label: "أوامر البيع", href: "/dashboard/sales-orders", icon: ShoppingCart },
      { label: "العملاء", href: "/dashboard/contacts/customers", icon: Users },
    ],
  },
  {
    label: "المشتريات",
    icon: ShoppingCart,
    children: [
      { label: "فواتير الموردين", href: "/dashboard/bills", icon: FileText },
      { label: "إشعارات الإضافة", href: "/dashboard/debit-notes", icon: FilePlus2 },
      { label: "أوامر الشراء", href: "/dashboard/purchase-orders", icon: Package },
      { label: "الموردون", href: "/dashboard/contacts/vendors", icon: Users },
    ],
  },
  {
    label: "المدفوعات",
    href: "/dashboard/payments",
    icon: CreditCard,
  },
  {
    label: "الخزينة والبنوك",
    icon: Building2,
    children: [
      { label: "الحسابات البنكية", href: "/dashboard/banking", icon: Building2 },
      { label: "التسوية البنكية", href: "/dashboard/banking/reconcile", icon: Wallet },
    ],
  },
  {
    label: "المخزون",
    href: "/dashboard/inventory",
    icon: Package,
  },
  {
    label: "الأصول الثابتة",
    href: "/dashboard/fixed-assets",
    icon: Briefcase,
  },
  {
    label: "الرواتب",
    href: "/dashboard/payroll",
    icon: Calculator,
  },
  {
    label: "التقارير",
    icon: BarChart3,
    children: [
      { label: "الميزانية العمومية", href: "/dashboard/reports/balance-sheet", icon: BarChart3 },
      { label: "الأرباح والخسائر", href: "/dashboard/reports/profit-loss", icon: TrendingUp },
      { label: "التدفق النقدي", href: "/dashboard/reports/cash-flow", icon: Wallet },
      { label: "ميزان المراجعة", href: "/dashboard/reports/trial-balance", icon: FileText },
      { label: "الذمم المدينة المتقادمة", href: "/dashboard/reports/aged-receivables", icon: Clock },
      { label: "الذمم الدائنة المتقادمة", href: "/dashboard/reports/aged-payables", icon: Clock },
      { label: "مراكز التكلفة", href: "/dashboard/reports/cost-centers", icon: Layers },
      { label: "دفتر اليومية", href: "/dashboard/reports/day-book", icon: BookOpen },
      { label: "تقرير ضريبة القيمة المضافة", href: "/dashboard/reports/vat", icon: DollarSign },
    ],
  },
  {
    label: "واتساب",
    href: "/dashboard/whatsapp",
    icon: MessageCircle,
  },
  {
    label: "المساعد الذكي",
    href: "/dashboard/ai-agent",
    icon: Bot,
  },
  {
    label: "استيراد البيانات",
    href: "/dashboard/import",
    icon: FileSpreadsheet,
  },
  {
    label: "تصدير البيانات",
    href: "/dashboard/export",
    icon: Download,
  },
  {
    label: "الفوترة والاشتراك",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    label: "سجل التدقيق",
    href: "/dashboard/audit",
    icon: Shield,
  },
  {
    label: "الإعدادات",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export default function Sidebar({ org }: { org: any }) {
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<string[]>(["المحاسبة", "المبيعات"])
  const country = getCountry(org.country || "SA")

  function toggleSection(label: string) {
    setOpenSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col h-full shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-blue-600 text-sm">HesabPro</p>
            <p className="text-xs text-gray-500 truncate max-w-[140px]">{org.name}</p>
            <p className="text-xs text-gray-400">{country.flag} {country.currencySymbol}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = openSections.includes(item.label)
            const isActive = item.children.some((c) => pathname === c.href)

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1",
                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </div>
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>

                {isOpen && (
                  <div className="mr-4 mb-1 border-r-2 border-gray-100 pr-2">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5",
                          pathname === child.href
                            ? "bg-blue-100 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        <child.icon className="h-3.5 w-3.5" />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1",
                pathname === item.href
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
