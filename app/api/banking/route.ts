import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const accounts = await prisma.bankAccount.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { account: { select: { name: true, code: true } } },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true, role: { in: ["OWNER", "ADMIN", "ACCOUNTANT"] } },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 })

  const { name, bankName, accountNumber, iban, openingBalance, accountId } = await req.json()

  if (!name) return NextResponse.json({ error: "اسم الحساب مطلوب" }, { status: 400 })

  // If no ledger account provided, try to find the default bank account
  let ledgerAccountId = accountId
  if (!ledgerAccountId) {
    const defaultBankAccount = await prisma.account.findFirst({
      where: { organizationId: userOrg.organizationId, accountType: "BANK" },
      orderBy: { code: "asc" },
    })
    if (!defaultBankAccount) {
      return NextResponse.json({ error: "لا يوجد حساب محاسبي للبنك — أضف حساباً من نوع BANK في دليل الحسابات" }, { status: 400 })
    }
    ledgerAccountId = defaultBankAccount.id
  }

  const openingAmt = Number(openingBalance || 0)

  const bankAccount = await prisma.bankAccount.create({
    data: {
      organizationId: userOrg.organizationId,
      name,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      iban: iban || null,
      currency: userOrg.organization.baseCurrency,
      currentBalance: openingAmt,
      accountId: ledgerAccountId,
    },
  })

  return NextResponse.json(bankAccount, { status: 201 })
}
