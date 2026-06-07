import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getCountry } from "@/lib/countries"
import * as XLSX from "xlsx"
import { xlsxResponse } from "@/lib/excel"

const BUCKETS = [
  { key: "current",     label: "جارية (لم تستحق)",  min: null, max: 0    },
  { key: "days1_30",    label: "1 - 30 يوم",          min: 1,    max: 30   },
  { key: "days31_60",   label: "31 - 60 يوم",         min: 31,   max: 60   },
  { key: "days61_90",   label: "61 - 90 يوم",         min: 61,   max: 90   },
  { key: "days91_120",  label: "91 - 120 يوم",        min: 91,   max: 120  },
  { key: "days120plus", label: "أكثر من 120 يوم",     min: 121,  max: null },
]

function getBucket(daysOverdue: number): string {
  if (daysOverdue <= 0)   return "current"
  if (daysOverdue <= 30)  return "days1_30"
  if (daysOverdue <= 60)  return "days31_60"
  if (daysOverdue <= 90)  return "days61_90"
  if (daysOverdue <= 120) return "days91_120"
  return "days120plus"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { searchParams } = req.nextUrl
  const asOf = searchParams.get("asOf") ? new Date(searchParams.get("asOf")!) : new Date()
  asOf.setHours(23, 59, 59, 999)
  const exportXlsx = searchParams.get("export") === "xlsx"
  const orgId = userOrg.organizationId
  const country = getCountry(userOrg.organization.country)

  const bills = await prisma.bill.findMany({
    where: {
      organizationId: orgId,
      type: "BILL",
      status: { notIn: ["CANCELLED", "PAID"] },
      amountDue: { gt: 0 },
      date: { lte: asOf },
    },
    select: {
      id:        true,
      number:    true,
      date:      true,
      dueDate:   true,
      total:     true,
      amountDue: true,
      contactId: true,
      contact:   { select: { id: true, name: true, phone: true, email: true } },
    },
  })

  const contactMap = new Map<string, {
    contact: { id: string; name: string; phone?: string | null; email?: string | null }
    current: number; days1_30: number; days31_60: number
    days61_90: number; days91_120: number; days120plus: number
    bills: any[]
  }>()

  for (const bill of bills) {
    const daysOverdue = Math.floor((asOf.getTime() - new Date(bill.dueDate).getTime()) / 86400000)
    const bucket = getBucket(daysOverdue)
    const amount = Number(bill.amountDue)

    if (!contactMap.has(bill.contactId)) {
      contactMap.set(bill.contactId, {
        contact: bill.contact,
        current: 0, days1_30: 0, days31_60: 0,
        days61_90: 0, days91_120: 0, days120plus: 0,
        bills: [],
      })
    }
    const entry = contactMap.get(bill.contactId)!
    ;(entry as any)[bucket] = Math.round(((entry as any)[bucket] + amount) * 100) / 100
    entry.bills.push({ id: bill.id, number: bill.number, date: bill.date, dueDate: bill.dueDate, daysOverdue, amount })
  }

  const rows = Array.from(contactMap.values()).map((entry) => ({
    contact:     entry.contact,
    current:     entry.current,
    days1_30:    entry.days1_30,
    days31_60:   entry.days31_60,
    days61_90:   entry.days61_90,
    days91_120:  entry.days91_120,
    days120plus: entry.days120plus,
    total: Math.round((entry.current + entry.days1_30 + entry.days31_60 + entry.days61_90 + entry.days91_120 + entry.days120plus) * 100) / 100,
    bills: entry.bills,
  })).sort((a, b) => b.total - a.total)

  const totals = rows.reduce((acc, r) => ({
    current:     Math.round((acc.current     + r.current)     * 100) / 100,
    days1_30:    Math.round((acc.days1_30    + r.days1_30)    * 100) / 100,
    days31_60:   Math.round((acc.days31_60   + r.days31_60)   * 100) / 100,
    days61_90:   Math.round((acc.days61_90   + r.days61_90)   * 100) / 100,
    days91_120:  Math.round((acc.days91_120  + r.days91_120)  * 100) / 100,
    days120plus: Math.round((acc.days120plus + r.days120plus) * 100) / 100,
    total:       Math.round((acc.total       + r.total)       * 100) / 100,
  }), { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91_120: 0, days120plus: 0, total: 0 })

  const result = { asOf: asOf.toISOString(), currency: country.currency, buckets: BUCKETS, rows, totals }

  if (exportXlsx) {
    const header = ["المورد", ...BUCKETS.map((b) => b.label), "الإجمالي"]
    const dataRows = rows.map((r) => [
      r.contact.name,
      r.current, r.days1_30, r.days31_60, r.days61_90, r.days91_120, r.days120plus,
      r.total,
    ])
    const totalRow = ["الإجمالي", totals.current, totals.days1_30, totals.days31_60, totals.days61_90, totals.days91_120, totals.days120plus, totals.total]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      [`تقرير الذمم الدائنة المتقادمة — بتاريخ ${asOf.toLocaleDateString("ar")}`],
      [],
      header,
      ...dataRows,
      [],
      totalRow,
    ])
    ws["!cols"] = [{ wch: 30 }, ...BUCKETS.map(() => ({ wch: 16 })), { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, "الذمم الدائنة")
    return xlsxResponse(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), "aged-payables")
  }

  return NextResponse.json(result)
}
