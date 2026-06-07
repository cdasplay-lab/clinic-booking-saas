import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"
import { getNextDocNumber } from "@/lib/org"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const quotes = await prisma.invoice.findMany({
    where: { organizationId: userOrg.organizationId, type: "QUOTE" },
    include: { contact: { select: { name: true } } },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const orgId = userOrg.organizationId
  const body = await req.json()
  const { contactId, date, dueDate, notes, terms, items = [] } = body

  if (!contactId) return NextResponse.json({ error: "العميل مطلوب" }, { status: 400 })
  if (!items.length) return NextResponse.json({ error: "أضف بنداً واحداً على الأقل" }, { status: 400 })

  let subtotal = 0
  let taxAmount = 0
  const lineItems = items.map((item: any, idx: number) => {
    const qty   = round2(parseFloat(item.quantity)  || 0)
    const price = round2(parseFloat(item.unitPrice) || 0)
    const lineSub = round2(qty * price)
    const taxAmt  = round2(parseFloat(item.taxAmount) || 0)
    subtotal  += lineSub
    taxAmount += taxAmt
    return {
      description: item.description || "",
      quantity:    qty,
      unitPrice:   price,
      taxRateId:   item.taxRateId || null,
      taxAmount:   taxAmt,
      total:       round2(lineSub + taxAmt),
      sortOrder:   idx,
    }
  })
  subtotal  = round2(subtotal)
  taxAmount = round2(taxAmount)
  const total = round2(subtotal + taxAmount)

  const number = await getNextDocNumber(orgId, "QUOTE")

  const quote = await prisma.invoice.create({
    data: {
      organizationId: orgId,
      contactId,
      number,
      type:      "QUOTE",
      status:    "DRAFT",
      date:      new Date(date),
      dueDate:   new Date(dueDate || date),  // dueDate = expiry date for quotes
      subtotal,
      taxAmount,
      total,
      amountDue: 0,   // quotes don't have AR until converted
      amountPaid: 0,
      notes:  notes  || null,
      terms:  terms  || null,
      items:  { create: lineItems },
    },
  })

  return NextResponse.json(quote, { status: 201 })
}
