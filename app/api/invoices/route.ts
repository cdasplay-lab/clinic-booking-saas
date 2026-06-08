import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getInventoryAccounts, recordCogsForSale } from "@/lib/inventory"
import { checkCreditLimit } from "@/lib/credit"
import { writeAuditLog } from "@/lib/audit"

const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity:    z.coerce.number().positive(),
  unitPrice:   z.coerce.number().min(0),
  discount:    z.coerce.number().min(0).max(100).default(0),
  taxRateId:   z.string().optional().nullable(),
  taxAmount:   z.coerce.number().min(0).default(0),
  productId:   z.string().optional().nullable(),
  accountId:   z.string().optional().nullable(),
})

const CreateInvoiceSchema = z.object({
  contactId: z.string().min(1),
  date:      z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dueDate:   z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes:     z.string().max(1000).optional().nullable(),
  terms:     z.string().max(500).optional().nullable(),
  items:     z.array(InvoiceItemSchema).min(1).max(200),
  overrideCreditLimit: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { contact: true, items: true },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const orgId = userOrg.organizationId
  const parsed = CreateInvoiceSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }
  const { contactId, date, dueDate, notes, items, overrideCreditLimit } = parsed.data

  let subtotal = 0
  let taxAmount = 0
  const lineItems = items.map((item: any) => {
    const qty   = parseFloat(item.quantity)  || 0
    const price = parseFloat(item.unitPrice) || 0
    const lineSubtotal = round2(qty * price)
    const lineTax      = round2(parseFloat(item.taxAmount) || 0)
    subtotal   = round2(subtotal   + lineSubtotal)
    taxAmount  = round2(taxAmount  + lineTax)
    return {
      description: item.description,
      productId:   item.productId || null,
      quantity:    qty,
      unitPrice:   price,
      taxRateId:   item.taxRateId || null,
      taxAmount:   lineTax,
      total:       round2(lineSubtotal + lineTax),
    }
  })

  const total = round2(subtotal + taxAmount)

  // Credit limit control — block the sale if it pushes the customer over their
  // limit, unless an authorized user explicitly overrides.
  if (!overrideCreditLimit) {
    const credit = await checkCreditLimit(orgId, contactId, total)
    if (credit.exceeded) {
      return NextResponse.json({
        error: "creditLimitExceeded",
        message: `العميل تجاوز حد الائتمان. الحد: ${credit.limit.toLocaleString()} — المستحق حالياً: ${credit.outstanding.toLocaleString()} — المتاح: ${Math.max(0, credit.available).toLocaleString()}`,
        credit,
      }, { status: 409 })
    }
  }

  const number = await getNextDocNumber(orgId, "INVOICE")

  // Find AR account
  const arAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" },
  })
  const revenueAccount = await prisma.account.findFirst({
    where: { organizationId: orgId, accountType: "REVENUE" },
  })

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      contactId,
      number,
      date: new Date(date),
      dueDate: new Date(dueDate),
      subtotal,
      taxAmount,
      total,
      amountDue: total,
      status: "DRAFT",
      notes,
      arAccountId: arAccount?.id,
      items: { create: lineItems },
    },
  })

  // Create journal entry if we have accounts
  if (arAccount && revenueAccount) {
    const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
      { accountId: arAccount.id, debit: total, credit: 0, description: `فاتورة ${number}` },
    ]

    if (taxAmount > 0) {
      const taxAccount = await prisma.account.findFirst({
        where: { organizationId: orgId, accountType: "TAX" },
      })
      if (taxAccount) {
        // Separate tax liability account: DR AR = CR Revenue + CR Tax
        journalLines.push({ accountId: revenueAccount.id, debit: 0, credit: subtotal, description: `إيرادات فاتورة ${number}` })
        journalLines.push({ accountId: taxAccount.id,     debit: 0, credit: taxAmount, description: `ضريبة مبيعات ${number}` })
      } else {
        // No tax account configured — credit full total to revenue (tax included)
        journalLines.push({ accountId: revenueAccount.id, debit: 0, credit: total, description: `إيرادات فاتورة ${number}` })
      }
    } else {
      journalLines.push({ accountId: revenueAccount.id, debit: 0, credit: total, description: `إيرادات فاتورة ${number}` })
    }

    await createJournalEntry({
      organizationId: orgId,
      date: new Date(date),
      type: "SALES",
      description: `فاتورة مبيعات ${number}`,
      sourceType: "invoice",
      sourceId: invoice.id,
      lines: journalLines,
    })

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT" },
    })

    // Perpetual inventory: reduce stock + record cost of goods sold
    const warehouse = await getOrCreateDefaultWarehouse(orgId)
    const cogsTotal = await recordCogsForSale({
      organizationId: orgId,
      warehouseId: warehouse.id,
      date: new Date(date),
      reference: number,
      items: lineItems.map((l: any) => ({ productId: l.productId, quantity: l.quantity })),
      createStockOut: true,
    })

    if (cogsTotal > 0) {
      const { inventory, cogs } = await getInventoryAccounts(orgId)
      if (inventory && cogs) {
        await createJournalEntry({
          organizationId: orgId,
          date: new Date(date),
          type: "SALES",
          description: `تكلفة بضاعة مباعة — فاتورة ${number}`,
          sourceType: "invoice-cogs",
          sourceId: invoice.id,
          lines: [
            { accountId: cogs.id,      debit: cogsTotal, credit: 0 },
            { accountId: inventory.id, debit: 0,         credit: cogsTotal },
          ],
        })
      }
    }
  }

  await writeAuditLog({
    organizationId: orgId,
    userId: session.user.id,
    userName: session.user.name || session.user.email || "",
    action: "CREATE",
    entityType: "INVOICE",
    entityId: invoice.id,
    entityLabel: number,
    ipAddress: req.headers.get("x-forwarded-for") || undefined,
  })

  return NextResponse.json(invoice, { status: 201 })
}
