import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry, round2 } from "@/lib/accounting"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const orgId = userOrg.organizationId

  const asset = await prisma.fixedAsset.findFirst({
    where: { id: params.id, organizationId: orgId },
  })
  if (!asset) return NextResponse.json({ error: "الأصل غير موجود" }, { status: 404 })
  if (asset.status !== "ACTIVE") return NextResponse.json({ error: "الأصل غير نشط" }, { status: 400 })

  const body = await req.json()
  const amount = round2(Number(body.amount))
  const date   = body.date ? new Date(body.date) : new Date()

  if (amount <= 0) return NextResponse.json({ error: "مبلغ الإهلاك يجب أن يكون موجباً" }, { status: 400 })

  const newValue = round2(Math.max(0, Number(asset.currentValue) - amount))

  // Find accumlated depreciation and expense accounts
  const [expenseAccount, assetAccount] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" }, orderBy: { code: "asc" } }),
    prisma.account.findFirst({ where: { organizationId: orgId, accountType: "FIXED_ASSET" }, orderBy: { code: "asc" } }),
  ])

  const [deprecEntry] = await prisma.$transaction([
    prisma.assetDepreciation.create({
      data: {
        assetId:   asset.id,
        date,
        amount,
        bookValue: newValue,
      },
    }),
    prisma.fixedAsset.update({
      where: { id: asset.id },
      data: { currentValue: newValue },
    }),
  ])

  if (expenseAccount && assetAccount) {
    const journal = await createJournalEntry({
      organizationId: orgId,
      date,
      type:        "GENERAL",
      description: `إهلاك ${asset.name} - ${date.toLocaleDateString("ar-SA")}`,
      sourceType:  "asset",
      sourceId:    asset.id,
      lines: [
        { accountId: expenseAccount.id, debit: amount, credit: 0,      description: `مصروف إهلاك ${asset.name}` },
        { accountId: assetAccount.id,   debit: 0,      credit: amount, description: `مجمع إهلاك ${asset.name}` },
      ],
    })
    // Link journal to depreciation record
    await prisma.assetDepreciation.update({
      where: { id: deprecEntry.id },
      data: { journalId: journal.id },
    })
  }

  return NextResponse.json({ success: true, newValue, amount })
}
