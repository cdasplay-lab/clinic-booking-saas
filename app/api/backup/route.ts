import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { fullBackupXlsx, xlsxResponse } from "@/lib/excel"

// GET /api/backup — generate and download full org backup as XLSX
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return new Response("Not found", { status: 404 })

  const org   = userOrg.organization
  const orgId = org.id

  const [invoices, bills, payments, contacts, products, accounts, journals] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId: orgId },
      include: { contact: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.bill.findMany({
      where: { organizationId: orgId },
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { contact: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.contact.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.account.findMany({
      where: { organizationId: orgId },
      orderBy: { code: "asc" },
    }),
    prisma.journal.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "desc" },
      take: 5000,
    }),
  ])

  const buf = fullBackupXlsx({ org, invoices, bills, payments, contacts, products, accounts, journals })

  const dateStr = new Date().toISOString().split("T")[0]
  return xlsxResponse(Buffer.from(buf), `نسخة_احتياطية_${org.name}_${dateStr}`)
}
