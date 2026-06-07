import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { round2 } from "@/lib/accounting"
import { getNextDocNumber } from "@/lib/org"
import { captureError } from "@/lib/logger"

const SaveSchema = z.object({
  date: z.string(),
  balances: z.array(z.object({
    accountId: z.string(),
    debit:     z.coerce.number().min(0).default(0),
    credit:    z.coerce.number().min(0).default(0),
  })),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ accounts: [], existing: null })

  const orgId = userOrg.organizationId

  const accounts = await prisma.account.findMany({
    where: { organizationId: orgId, isActive: true },
    include: { group: true },
    orderBy: { code: "asc" },
  })

  // Existing opening journal (if previously saved) so the form can prefill
  const existing = await prisma.journal.findFirst({
    where: { organizationId: orgId, type: "OPENING" },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id, code: a.code, name: a.name, nature: a.nature,
      accountType: a.accountType, groupName: a.group.name,
    })),
    existing: existing
      ? { date: existing.date, lines: existing.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) })) }
      : null,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId
  const parsed = SaveSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 })
  const { date, balances } = parsed.data

  try {
    // Build lines, dropping zero rows
    const lines = balances
      .map((b) => ({ accountId: b.accountId, debit: round2(b.debit), credit: round2(b.credit) }))
      .filter((l) => l.debit > 0 || l.credit > 0)

    if (lines.length === 0) return NextResponse.json({ error: "أدخل رصيداً واحداً على الأقل" }, { status: 400 })

    let totalDebit  = round2(lines.reduce((s, l) => s + l.debit, 0))
    let totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
    const diff = round2(totalDebit - totalCredit)

    // Auto-plug any imbalance to Retained Earnings (الأرباح المبقاة) — standard for openings
    if (Math.abs(diff) > 0.01) {
      let retained = await prisma.account.findFirst({ where: { organizationId: orgId, code: "3020" } })
      if (!retained) retained = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EQUITY" } })
      if (!retained) return NextResponse.json({ error: "القيد غير متوازن ولا يوجد حساب أرباح مبقاة للتسوية" }, { status: 400 })

      if (diff > 0) lines.push({ accountId: retained.id, debit: 0, credit: diff })   // more debits → credit equity
      else          lines.push({ accountId: retained.id, debit: -diff, credit: 0 })  // more credits → debit equity
      totalDebit  = round2(lines.reduce((s, l) => s + l.debit, 0))
      totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
    }

    // Replace any previous opening entry (idempotent / re-editable)
    const prev = await prisma.journal.findFirst({ where: { organizationId: orgId, type: "OPENING" } })
    if (prev) {
      await prisma.journalLine.deleteMany({ where: { journalId: prev.id } })
      await prisma.journal.delete({ where: { id: prev.id } })
    }

    const number = await getNextDocNumber(orgId, "JOURNAL")
    await prisma.journal.create({
      data: {
        organizationId: orgId,
        number,
        date: new Date(date),
        type: "OPENING",
        description: "الأرصدة الافتتاحية",
        status: "POSTED",
        totalDebit,
        totalCredit,
        lines: { create: lines },
      },
    })

    // Mirror onto account.openingBalance for quick reference
    for (const l of lines) {
      const acc = await prisma.account.findUnique({ where: { id: l.accountId }, select: { nature: true } })
      if (!acc) continue
      const bal = acc.nature === "DEBIT" ? round2(l.debit - l.credit) : round2(l.credit - l.debit)
      await prisma.account.update({
        where: { id: l.accountId },
        data: { openingBalance: bal, openingDate: new Date(date) },
      })
    }

    return NextResponse.json({ success: true, totalDebit, totalCredit })
  } catch (e: any) {
    captureError(e, { route: "opening-balances", orgId })
    return NextResponse.json({ error: "حدث خطأ في حفظ الأرصدة" }, { status: 500 })
  }
}
