import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  if (!q) return NextResponse.json([])

  const serials = await prisma.productSerial.findMany({
    where: {
      organizationId: userOrg.organizationId,
      serialNumber: { contains: q, mode: "insensitive" },
    },
    include: {
      product: { select: { id: true, name: true, code: true, salePrice: true } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  })

  // Enrich with invoice data where sold
  const soldIds = serials.map((s) => s.soldInvoiceId).filter(Boolean) as string[]
  const invoices = soldIds.length
    ? await prisma.invoice.findMany({
        where: { id: { in: soldIds } },
        select: {
          id: true, number: true, date: true,
          contact: { select: { name: true, phone: true } },
        },
      })
    : []
  const invoiceMap = Object.fromEntries(invoices.map((i) => [i.id, i]))

  const result = serials.map((s) => ({
    ...s,
    soldInvoice: s.soldInvoiceId ? (invoiceMap[s.soldInvoiceId] ?? null) : null,
  }))

  return NextResponse.json(result)
}
