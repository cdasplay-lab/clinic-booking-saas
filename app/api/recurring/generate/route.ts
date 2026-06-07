import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry } from "@/lib/accounting"
import { addDays, addWeeks, addMonths, addQuarters, addYears } from "@/lib/date-utils"

// Called by cron (e.g. Vercel cron or external scheduler)
// Protected by CRON_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const now = new Date()

  // Find all active recurring invoices due today or earlier
  const duelist = await prisma.recurringInvoice.findMany({
    where: {
      status: "ACTIVE",
      nextDate: { lte: now },
    },
    include: {
      items: { include: { taxRate: true } },
      organization: true,
    },
  })

  let generated = 0
  const errors: string[] = []

  for (const rec of duelist) {
    try {
      const orgId = rec.organizationId

      // Calculate totals
      let subtotal = 0
      let taxAmount = 0
      const lineItems = rec.items.map((item) => {
        const qty = Number(item.quantity)
        const price = Number(item.unitPrice)
        const lineSub = qty * price
        const taxRate = item.taxRate ? Number(item.taxRate.rate) / 100 : 0
        const lineTax = Math.round(lineSub * taxRate * 100) / 100
        subtotal += lineSub
        taxAmount += lineTax
        return {
          description: item.description,
          quantity: qty,
          unitPrice: price,
          taxRateId: item.taxRateId,
          taxAmount: lineTax,
          total: lineSub + lineTax,
          sortOrder: item.sortOrder,
        }
      })
      const total = subtotal + taxAmount

      const issueDate = rec.nextDate
      const dueDate = addDays(issueDate, rec.dueDays)
      const number = await getNextDocNumber(orgId, "INVOICE")

      const arAccount = await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" },
      })

      const invoice = await prisma.invoice.create({
        data: {
          organizationId: orgId,
          contactId: rec.contactId,
          number,
          date: issueDate,
          dueDate,
          subtotal,
          taxAmount,
          total,
          amountDue: total,
          status: "DRAFT",
          notes: rec.notes,
          arAccountId: arAccount?.id,
          items: { create: lineItems },
        },
      })

      // Journal entry
      const revenueAccount = await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "REVENUE" },
      })
      if (arAccount && revenueAccount) {
        const jLines = [
          { accountId: arAccount.id, debit: total, credit: 0, description: `فاتورة متكررة ${number}` },
          { accountId: revenueAccount.id, debit: 0, credit: subtotal, description: `إيرادات ${number}` },
        ]
        if (taxAmount > 0) {
          const taxAccount = await prisma.account.findFirst({
            where: { organizationId: orgId, accountType: "TAX" },
          })
          if (taxAccount) {
            jLines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount, description: `ضريبة ${number}` })
          }
        }
        await createJournalEntry({
          organizationId: orgId,
          date: issueDate,
          type: "SALES",
          description: `فاتورة متكررة ${number} — ${rec.title}`,
          sourceType: "invoice",
          sourceId: invoice.id,
          lines: jLines,
        })
      }

      // Advance nextDate
      const nextDate = calcNextDate(rec.nextDate, rec.frequency)
      const shouldEnd = rec.endDate && nextDate > rec.endDate

      await prisma.recurringInvoice.update({
        where: { id: rec.id },
        data: {
          nextDate,
          totalGenerated: { increment: 1 },
          status: shouldEnd ? "ENDED" : "ACTIVE",
        },
      })

      generated++
    } catch (err: any) {
      errors.push(`${rec.id}: ${err.message}`)
    }
  }

  return NextResponse.json({ generated, errors, checked: duelist.length })
}

// GET version for easy manual trigger in dev
export async function GET(req: NextRequest) {
  return POST(req)
}

function calcNextDate(from: Date, frequency: string): Date {
  switch (frequency) {
    case "WEEKLY":    return addWeeks(from, 1)
    case "MONTHLY":   return addMonths(from, 1)
    case "QUARTERLY": return addQuarters(from, 1)
    case "YEARLY":    return addYears(from, 1)
    default:          return addMonths(from, 1)
  }
}
