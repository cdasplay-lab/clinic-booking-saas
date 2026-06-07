import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No org" }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()))
  const quarter = parseInt(searchParams.get("quarter") || "1")

  const startMonth = (quarter - 1) * 3
  const startDate = new Date(year, startMonth, 1)
  const endDate = new Date(year, startMonth + 3, 0)

  const [salesTax, purchaseTax] = await Promise.all([
    prisma.invoiceItem.aggregate({
      where: { invoice: { organizationId: userOrg.organizationId, date: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } } },
      _sum: { taxAmount: true, total: true },
    }),
    prisma.billItem.aggregate({
      where: { bill: { organizationId: userOrg.organizationId, date: { gte: startDate, lte: endDate }, status: { not: "CANCELLED" } } },
      _sum: { taxAmount: true, total: true },
    }),
  ])

  const outputVAT = Number(salesTax._sum.taxAmount || 0)
  const inputVAT = Number(purchaseTax._sum.taxAmount || 0)
  const netVAT = outputVAT - inputVAT

  // salesTotal / purchasesTotal = taxable base (excl. tax)
  const salesTotal     = Number(salesTax._sum.total     || 0) - outputVAT
  const purchasesTotal = Number(purchaseTax._sum.total  || 0) - inputVAT

  return NextResponse.json({
    period: `الربع ${quarter} - ${year}`,
    startDate,
    endDate,
    salesTotal,
    outputVAT,
    purchasesTotal,
    inputVAT,
    netVATDue: netVAT,
    isPayable: netVAT > 0,
  })
}
