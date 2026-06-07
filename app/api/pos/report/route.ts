import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId
  const { searchParams } = new URL(req.url)
  const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10)
  const from = new Date(dateStr + "T00:00:00.000Z")
  const to   = new Date(dateStr + "T23:59:59.999Z")

  const [sessions, topProducts] = await Promise.all([
    prisma.posSession.findMany({
      where: {
        organizationId: orgId,
        openedAt: { gte: from, lte: to },
      },
      include: {
        cashier: { select: { name: true } },
        transactions: {
          where: { status: "COMPLETED" },
          select: { total: true, paymentMethod: true },
        },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.posTransactionItem.findMany({
      where: {
        transaction: {
          organizationId: orgId,
          date: { gte: from, lte: to },
          status: "COMPLETED",
        },
      },
      include: { product: { select: { name: true, code: true } } },
    }),
  ])

  // Aggregate top products
  const productMap: Record<string, { name: string; code: string; qty: number; total: number }> = {}
  for (const item of topProducts) {
    const key = item.productId
    if (!productMap[key]) {
      productMap[key] = { name: item.product.name, code: item.product.code, qty: 0, total: 0 }
    }
    productMap[key].qty   += Number(item.quantity)
    productMap[key].total += Number(item.total)
  }
  const topProductsList = Object.values(productMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Summary
  const totalSales = sessions.reduce((s, sess) =>
    s + sess.transactions.reduce((t, tx) => t + Number(tx.total), 0), 0)
  const totalCash  = sessions.reduce((s, sess) =>
    s + sess.transactions.filter((tx) => tx.paymentMethod === "CASH").reduce((t, tx) => t + Number(tx.total), 0), 0)
  const totalCard  = sessions.reduce((s, sess) =>
    s + sess.transactions.filter((tx) => tx.paymentMethod === "CARD").reduce((t, tx) => t + Number(tx.total), 0), 0)
  const totalTxCount = sessions.reduce((s, sess) => s + sess.transactions.length, 0)

  return NextResponse.json({
    date: dateStr,
    totalSales,
    totalCash,
    totalCard,
    totalTxCount,
    sessions: sessions.map((s) => ({
      id:        s.id,
      number:    s.number,
      cashier:   s.cashier.name,
      openedAt:  s.openedAt,
      closedAt:  s.closedAt,
      status:    s.status,
      totalSales: s.totalSales,
      txCount:   s.transactions.length,
    })),
    topProducts: topProductsList,
  })
}
