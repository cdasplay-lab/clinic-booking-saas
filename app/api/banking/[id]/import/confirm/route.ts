import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"

// POST /api/banking/[id]/import/confirm
// Saves selected parsed rows as BankTransactions and updates account balance
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: params.id, organizationId: userOrg.organizationId },
  })
  if (!bankAccount) return NextResponse.json({ error: "الحساب البنكي غير موجود" }, { status: 404 })

  const { rows } = await req.json() as {
    rows: Array<{
      date: string
      description: string
      debit: number
      credit: number
      balance: number
    }>
  }

  if (!rows?.length) return NextResponse.json({ error: "لا توجد حركات للاستيراد" }, { status: 400 })

  const orgId = userOrg.organizationId

  // Deduplicate against existing transactions
  const existing = await prisma.bankTransaction.findMany({
    where: { bankAccountId: params.id },
    select: { date: true, debit: true, credit: true, description: true },
  })
  const existingKeys = new Set(
    existing.map((t) =>
      `${t.date.toISOString().split("T")[0]}_${Number(t.debit)}_${Number(t.credit)}_${t.description.slice(0, 30)}`
    )
  )

  const toInsert = rows.filter((row) => {
    const key = `${row.date}_${row.debit}_${row.credit}_${row.description.slice(0, 30)}`
    return !existingKeys.has(key)
  })

  if (!toInsert.length) {
    return NextResponse.json({ imported: 0, message: "جميع الحركات موجودة مسبقاً" })
  }

  // Bulk insert
  await prisma.bankTransaction.createMany({
    data: toInsert.map((row) => ({
      organizationId: orgId,
      bankAccountId:  params.id,
      date:           new Date(row.date),
      description:    row.description || "—",
      debit:          round2(row.debit),
      credit:         round2(row.credit),
      balance:        round2(row.balance),
      status:         "UNRECONCILED",
    })),
  })

  // Update bank account current balance to the last row's balance (if provided)
  const lastBalanceRow = [...toInsert].reverse().find((r) => r.balance !== 0)
  if (lastBalanceRow) {
    await prisma.bankAccount.update({
      where: { id: params.id },
      data:  { currentBalance: round2(lastBalanceRow.balance) },
    })
  }

  return NextResponse.json({ imported: toInsert.length, skipped: rows.length - toInsert.length })
}
