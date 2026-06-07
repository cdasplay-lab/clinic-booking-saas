import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry, round2 } from "@/lib/accounting"
import { getChequeAccount, getControlAccount } from "@/lib/cheques"
import { captureError } from "@/lib/logger"

const ActionSchema = z.object({
  action:        z.enum(["deposit", "clear", "bounce", "cancel"]),
  bankAccountId: z.string().optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cheque = await prisma.cheque.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
    include: { contact: true, bankAccount: true },
  })
  if (!cheque) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(cheque)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT", "MANAGER"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const parsed = ActionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "إجراء غير صحيح" }, { status: 400 })
  const { action, bankAccountId } = parsed.data

  const cheque = await prisma.cheque.findFirst({
    where: { id: params.id, organizationId: orgId },
  })
  if (!cheque) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isIncoming = cheque.type === "INCOMING"
  const amount = round2(Number(cheque.amount))

  try {
    // ── DEPOSIT (incoming only): mark as sent to bank for collection ──
    if (action === "deposit") {
      if (cheque.status !== "PENDING") return NextResponse.json({ error: "لا يمكن إيداع هذا الشيك" }, { status: 400 })
      const updated = await prisma.cheque.update({
        where: { id: cheque.id },
        data: { status: "DEPOSITED", depositedAt: new Date(), bankAccountId: bankAccountId || cheque.bankAccountId },
      })
      return NextResponse.json(updated)
    }

    // ── CLEAR: cheque cashed successfully ──
    if (action === "clear") {
      if (!["PENDING", "DEPOSITED"].includes(cheque.status)) {
        return NextResponse.json({ error: "لا يمكن تحصيل هذا الشيك" }, { status: 400 })
      }

      // Need a bank account to hit. Resolve its GL account.
      const targetBankId = bankAccountId || cheque.bankAccountId
      const bankAccount = targetBankId
        ? await prisma.bankAccount.findFirst({ where: { id: targetBankId, organizationId: orgId }, include: { account: true } })
        : await prisma.bankAccount.findFirst({ where: { organizationId: orgId }, include: { account: true } })

      const chequeAccount = await getChequeAccount(orgId, cheque.type)
      const bankGl = bankAccount?.account
        ?? await prisma.account.findFirst({ where: { organizationId: orgId, accountType: { in: ["BANK", "CASH"] } } })

      let clearJournalId: string | null = null
      if (chequeAccount && bankGl) {
        const journal = await createJournalEntry({
          organizationId: orgId,
          date: new Date(),
          type: isIncoming ? "RECEIPT" : "PAYMENT",
          description: isIncoming
            ? `تحصيل شيك ${cheque.chequeNumber} من ${cheque.partyName}`
            : `صرف شيك ${cheque.chequeNumber} لـ ${cheque.partyName}`,
          lines: isIncoming
            ? [
                { accountId: bankGl.id,        debit: amount, credit: 0 },
                { accountId: chequeAccount.id, debit: 0,      credit: amount },
              ]
            : [
                { accountId: chequeAccount.id, debit: amount, credit: 0 },
                { accountId: bankGl.id,        debit: 0,      credit: amount },
              ],
        })
        clearJournalId = journal.id

        // Update bank running balance
        if (bankAccount) {
          await prisma.bankAccount.update({
            where: { id: bankAccount.id },
            data: { currentBalance: { increment: isIncoming ? amount : -amount } },
          })
        }
      }

      const updated = await prisma.cheque.update({
        where: { id: cheque.id },
        data: { status: "CLEARED", clearedAt: new Date(), clearJournalId, bankAccountId: bankAccount?.id || cheque.bankAccountId },
      })
      return NextResponse.json(updated)
    }

    // ── BOUNCE: cheque returned/dishonored → reverse the record entry ──
    if (action === "bounce") {
      if (cheque.status === "CLEARED" || cheque.status === "CANCELLED") {
        return NextResponse.json({ error: "لا يمكن إرجاع هذا الشيك" }, { status: 400 })
      }
      const chequeAccount  = await getChequeAccount(orgId, cheque.type)
      const controlAccount = await getControlAccount(orgId, isIncoming ? "AR" : "AP")

      let clearJournalId: string | null = null
      if (chequeAccount && controlAccount) {
        const journal = await createJournalEntry({
          organizationId: orgId,
          date: new Date(),
          type: "GENERAL",
          description: `ارتداد شيك ${cheque.chequeNumber} — ${cheque.partyName}`,
          lines: isIncoming
            ? [
                { accountId: controlAccount.id, debit: amount, credit: 0 },
                { accountId: chequeAccount.id,  debit: 0,      credit: amount },
              ]
            : [
                { accountId: chequeAccount.id,  debit: amount, credit: 0 },
                { accountId: controlAccount.id, debit: 0,      credit: amount },
              ],
        })
        clearJournalId = journal.id
      }

      const updated = await prisma.cheque.update({
        where: { id: cheque.id },
        data: { status: "BOUNCED", bouncedAt: new Date(), clearJournalId },
      })
      return NextResponse.json(updated)
    }

    // ── CANCEL: void a pending cheque → reverse the record entry ──
    if (action === "cancel") {
      if (cheque.status === "CLEARED") {
        return NextResponse.json({ error: "لا يمكن إلغاء شيك محصّل" }, { status: 400 })
      }
      const chequeAccount  = await getChequeAccount(orgId, cheque.type)
      const controlAccount = await getControlAccount(orgId, isIncoming ? "AR" : "AP")

      let clearJournalId: string | null = null
      if (cheque.recordJournalId && chequeAccount && controlAccount) {
        const journal = await createJournalEntry({
          organizationId: orgId,
          date: new Date(),
          type: "GENERAL",
          description: `إلغاء شيك ${cheque.chequeNumber} — ${cheque.partyName}`,
          lines: isIncoming
            ? [
                { accountId: controlAccount.id, debit: amount, credit: 0 },
                { accountId: chequeAccount.id,  debit: 0,      credit: amount },
              ]
            : [
                { accountId: chequeAccount.id,  debit: amount, credit: 0 },
                { accountId: controlAccount.id, debit: 0,      credit: amount },
              ],
        })
        clearJournalId = journal.id
      }

      const updated = await prisma.cheque.update({
        where: { id: cheque.id },
        data: { status: "CANCELLED", clearJournalId },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })
  } catch (e: any) {
    captureError(e, { route: "cheques.patch", chequeId: cheque.id })
    return NextResponse.json({ error: "حدث خطأ في معالجة الشيك" }, { status: 500 })
  }
}
