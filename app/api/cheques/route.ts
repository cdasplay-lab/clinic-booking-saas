import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getNextDocNumber } from "@/lib/org"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getChequeAccount, getControlAccount } from "@/lib/cheques"
import { captureError } from "@/lib/logger"

const CreateChequeSchema = z.object({
  type:         z.enum(["INCOMING", "OUTGOING"]),
  chequeNumber: z.string().min(1).max(50).trim(),
  bankName:     z.string().max(100).optional().nullable(),
  partyName:    z.string().min(1).max(150).trim(),
  amount:       z.coerce.number().positive(),
  currency:     z.string().max(8).optional(),
  issueDate:    z.string(),
  dueDate:      z.string(),
  contactName:  z.string().max(150).optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const { searchParams } = new URL(req.url)
  const type   = searchParams.get("type")   // INCOMING | OUTGOING
  const status = searchParams.get("status") // PENDING | DEPOSITED | ...

  const cheques = await prisma.cheque.findMany({
    where: {
      organizationId: userOrg.organizationId,
      ...(type   ? { type:   type as any }   : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: { contact: true, bankAccount: true },
    orderBy: { dueDate: "asc" },
  })

  return NextResponse.json(cheques)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const parsed = CreateChequeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }
  const d = parsed.data
  const isIncoming = d.type === "INCOMING"
  const amount = round2(d.amount)

  try {
    // Resolve/link a contact if a name was provided
    let contactId: string | null = null
    if (d.contactName) {
      let contact = await prisma.contact.findFirst({
        where: { organizationId: orgId, name: { contains: d.contactName, mode: "insensitive" } },
      })
      if (!contact) {
        contact = await prisma.contact.create({
          data: { organizationId: orgId, name: d.contactName, type: isIncoming ? "CUSTOMER" : "VENDOR" },
        })
      }
      contactId = contact.id
    }

    // Accounting entry on record
    const chequeAccount = await getChequeAccount(orgId, d.type)
    const controlAccount = await getControlAccount(orgId, isIncoming ? "AR" : "AP")

    let recordJournalId: string | null = null
    if (chequeAccount && controlAccount) {
      const journal = await createJournalEntry({
        organizationId: orgId,
        date: new Date(d.issueDate),
        type: isIncoming ? "RECEIPT" : "PAYMENT",
        description: isIncoming
          ? `استلام شيك ${d.chequeNumber} من ${d.partyName}`
          : `إصدار شيك ${d.chequeNumber} لـ ${d.partyName}`,
        lines: isIncoming
          ? [
              { accountId: chequeAccount.id,  debit: amount, credit: 0 },
              { accountId: controlAccount.id, debit: 0,      credit: amount },
            ]
          : [
              { accountId: controlAccount.id, debit: amount, credit: 0 },
              { accountId: chequeAccount.id,  debit: 0,      credit: amount },
            ],
      })
      recordJournalId = journal.id
    }

    const docType = isIncoming ? "CHEQUE_IN" : "CHEQUE_OUT"
    await getNextDocNumber(orgId, docType) // reserve a sequence (kept for audit/ref)

    const cheque = await prisma.cheque.create({
      data: {
        organizationId: orgId,
        type: d.type,
        chequeNumber: d.chequeNumber,
        bankName: d.bankName || null,
        partyName: d.partyName,
        amount,
        currency: d.currency || "AED",
        issueDate: new Date(d.issueDate),
        dueDate: new Date(d.dueDate),
        status: "PENDING",
        contactId,
        bankAccountId: d.bankAccountId || null,
        recordJournalId,
        notes: d.notes || null,
      },
    })

    return NextResponse.json(cheque, { status: 201 })
  } catch (e: any) {
    captureError(e, { route: "cheques.create", orgId })
    return NextResponse.json({ error: "حدث خطأ في تسجيل الشيك" }, { status: 500 })
  }
}
