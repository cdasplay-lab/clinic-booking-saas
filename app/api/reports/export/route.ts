import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTrialBalance, getProfitAndLoss } from "@/lib/accounting"
import {
  trialBalanceXlsx, profitLossXlsx,
  invoicesXlsx, billsXlsx, journalsXlsx,
  contactsXlsx, paymentsXlsx, productsXlsx, accountsXlsx,
  xlsxResponse,
} from "@/lib/excel"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
    include: { organization: true },
  })
  if (!userOrg) return new Response("Not found", { status: 404 })

  const org = userOrg.organization
  const orgId = org.id
  const type = req.nextUrl.searchParams.get("type") || "trial-balance"
  const now = new Date()

  switch (type) {
    case "trial-balance": {
      const asOf = new Date(req.nextUrl.searchParams.get("asOf") || now.toISOString())
      const accounts = await getTrialBalance(orgId, asOf)
      const buf = trialBalanceXlsx(accounts, org.name, org.country, asOf)
      return xlsxResponse(Buffer.from(buf), `ميزان_المراجعة_${org.name}`)
    }

    case "profit-loss": {
      const from = new Date(req.nextUrl.searchParams.get("from") || new Date(now.getFullYear(), 0, 1).toISOString())
      const to   = new Date(req.nextUrl.searchParams.get("to")   || now.toISOString())
      const data = await getProfitAndLoss(orgId, from, to)
      const buf  = profitLossXlsx(data, org.name, org.country, from, to)
      return xlsxResponse(Buffer.from(buf), `الأرباح_والخسائر_${org.name}`)
    }

    case "invoices": {
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: orgId },
        include: { contact: { select: { name: true } } },
        orderBy: { date: "desc" },
      })
      const buf = invoicesXlsx(invoices, org.name, org.country)
      return xlsxResponse(Buffer.from(buf), `الفواتير_${org.name}`)
    }

    case "bills": {
      const bills = await prisma.bill.findMany({
        where: { organizationId: orgId },
        include: { contact: { select: { name: true } } },
        orderBy: { date: "desc" },
      })
      const buf = billsXlsx(bills, org.name, org.country)
      return xlsxResponse(Buffer.from(buf), `فواتير_الموردين_${org.name}`)
    }

    case "journals": {
      const journals = await prisma.journal.findMany({
        where: { organizationId: orgId },
        orderBy: { date: "desc" },
        take: 1000,
      })
      const buf = journalsXlsx(journals, org.name, org.country)
      return xlsxResponse(Buffer.from(buf), `اليومية_${org.name}`)
    }

    case "contacts": {
      const contacts = await prisma.contact.findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
      })
      const buf = contactsXlsx(contacts, org.name)
      return xlsxResponse(Buffer.from(buf), `جهات_الاتصال_${org.name}`)
    }

    case "payments": {
      const payments = await prisma.payment.findMany({
        where: { organizationId: orgId },
        include: { contact: { select: { name: true } } },
        orderBy: { date: "desc" },
      })
      const buf = paymentsXlsx(payments, org.name, org.country)
      return xlsxResponse(Buffer.from(buf), `المدفوعات_${org.name}`)
    }

    case "products": {
      const products = await prisma.product.findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
      })
      const buf = productsXlsx(products, org.name)
      return xlsxResponse(Buffer.from(buf), `المنتجات_${org.name}`)
    }

    case "accounts": {
      const accounts = await prisma.account.findMany({
        where: { organizationId: orgId },
        orderBy: { code: "asc" },
      })
      const buf = accountsXlsx(accounts, org.name)
      return xlsxResponse(Buffer.from(buf), `دليل_الحسابات_${org.name}`)
    }

    default:
      return new Response("نوع التقرير غير معروف", { status: 400 })
  }
}
