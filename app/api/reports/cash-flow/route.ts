import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userOrg = await prisma.userOrganization.findFirst({ where: { userId: session.user.id, isDefault: true } })
  if (!userOrg) return NextResponse.json({ error: "No org" }, { status: 400 })

  const orgId = userOrg.organizationId
  const now = new Date()
  const months = []

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)

    const [inflows, outflows] = await Promise.all([
      prisma.journalLine.aggregate({
        where: {
          journal: { organizationId: orgId, date: { gte: start, lte: end }, status: "POSTED" },
          account: { accountType: { in: ["CASH", "BANK"] } },
          credit: { gt: 0 },
        },
        _sum: { credit: true },
      }),
      prisma.journalLine.aggregate({
        where: {
          journal: { organizationId: orgId, date: { gte: start, lte: end }, status: "POSTED" },
          account: { accountType: { in: ["CASH", "BANK"] } },
          debit: { gt: 0 },
        },
        _sum: { debit: true },
      }),
    ])

    months.push({
      month: start.toLocaleDateString("ar-SA", { month: "short", year: "numeric" }),
      inflows: Number(inflows._sum.credit || 0),
      outflows: Number(outflows._sum.debit || 0),
      net: Number(inflows._sum.credit || 0) - Number(outflows._sum.debit || 0),
    })
  }

  return NextResponse.json({ months })
}
