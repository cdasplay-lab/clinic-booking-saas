import { prisma } from "./prisma"
import { JournalType, Prisma } from "@prisma/client"

/** Round to 2 decimal places — use for all monetary intermediate values */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function createJournalEntry({
  organizationId,
  date,
  type,
  description,
  reference,
  lines,
  sourceType,
  sourceId,
}: {
  organizationId: string
  date: Date
  type: JournalType
  description: string
  reference?: string
  lines: Array<{
    accountId: string
    debit: number
    credit: number
    description?: string
    costCenterId?: string
  }>
  sourceType?: string
  sourceId?: string
}, db?: Prisma.TransactionClient | typeof prisma) {
  const _db = db ?? prisma

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry unbalanced: Debit ${totalDebit} ≠ Credit ${totalCredit}`)
  }

  // Block posting into a closed fiscal year (except the closing entry itself)
  if (type !== "CLOSING") {
    const closedYear = await _db.fiscalYear.findFirst({
      where: { organizationId, isClosed: true, startDate: { lte: date }, endDate: { gte: date } },
      select: { name: true },
    })
    if (closedYear) {
      throw new Error(`السنة المالية "${closedYear.name}" مقفلة — لا يمكن التسجيل في فترة مقفلة`)
    }
  }

  const { getNextDocNumber } = await import("./org")
  const number = await getNextDocNumber(organizationId, "JOURNAL")

  const journal = await _db.journal.create({
    data: {
      organizationId,
      number,
      date,
      type,
      description,
      reference,
      totalDebit,
      totalCredit,
      sourceType,
      sourceId,
      lines: {
        create: lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
          costCenterId: l.costCenterId,
        })),
      },
    },
    include: { lines: true },
  })

  return journal
}

export async function getAccountBalance(accountId: string, asOfDate?: Date) {
  const where = asOfDate
    ? { accountId, journal: { date: { lte: asOfDate } } }
    : { accountId }

  const result = await prisma.journalLine.aggregate({
    where,
    _sum: { debit: true, credit: true },
  })

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { nature: true, openingBalance: true },
  })

  const debit = Number(result._sum.debit || 0)
  const credit = Number(result._sum.credit || 0)
  const opening = Number(account?.openingBalance || 0)

  if (account?.nature === "DEBIT") {
    return opening + debit - credit
  } else {
    return opening + credit - debit
  }
}

export async function getTrialBalance(organizationId: string, asOfDate?: Date) {
  const accounts = await prisma.account.findMany({
    where: { organizationId, isActive: true },
    include: {
      group: true,
      journalLines: {
        where: asOfDate
          ? { journal: { date: { lte: asOfDate }, status: "POSTED" } }
          : { journal: { status: "POSTED" } },
      },
    },
  })

  return accounts.map((account) => {
    const debit = account.journalLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = account.journalLines.reduce((s, l) => s + Number(l.credit), 0)
    const opening = Number(account.openingBalance)

    let balance: number
    if (account.nature === "DEBIT") {
      balance = opening + debit - credit
    } else {
      balance = opening + credit - debit
    }

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      groupName: account.group.name,
      nature: account.nature,
      accountType: account.accountType,
      debit,
      credit,
      balance,
    }
  }).filter((a) => Math.abs(a.balance) > 0.001 || a.debit > 0 || a.credit > 0)
}

export async function getProfitAndLoss(
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      isActive: true,
      accountType: { in: ["REVENUE", "EXPENSE"] },
    },
    include: {
      group: true,
      journalLines: {
        where: {
          journal: {
            organizationId,
            date: { gte: startDate, lte: endDate },
            status: "POSTED",
          },
        },
      },
    },
  })

  let totalRevenue = 0
  let totalExpenses = 0
  const revenues: any[] = []
  const expenses: any[] = []

  for (const account of accounts) {
    const debit = account.journalLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = account.journalLines.reduce((s, l) => s + Number(l.credit), 0)

    if (account.accountType === "REVENUE") {
      const amount = credit - debit
      totalRevenue += amount
      revenues.push({ ...account, amount })
    } else {
      const amount = debit - credit
      totalExpenses += amount
      expenses.push({ ...account, amount })
    }
  }

  return {
    revenues,
    expenses,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
  }
}

export async function getBalanceSheet(organizationId: string, asOfDate: Date) {
  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      isActive: true,
      accountType: {
        in: ["ASSET", "LIABILITY", "EQUITY", "BANK", "CASH", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE", "STOCK", "FIXED_ASSET"],
      },
    },
    include: {
      group: true,
      journalLines: {
        where: {
          journal: {
            organizationId,
            date: { lte: asOfDate },
            status: "POSTED",
          },
        },
      },
    },
  })

  const assets: any[] = []
  const liabilities: any[] = []
  const equity: any[] = []

  for (const account of accounts) {
    const debit = account.journalLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = account.journalLines.reduce((s, l) => s + Number(l.credit), 0)
    const opening = Number(account.openingBalance)

    let balance: number
    if (account.nature === "DEBIT") {
      balance = opening + debit - credit
    } else {
      balance = opening + credit - debit
    }

    const item = { ...account, balance }

    if (["ASSET", "BANK", "CASH", "ACCOUNTS_RECEIVABLE", "STOCK", "FIXED_ASSET"].includes(account.accountType)) {
      assets.push(item)
    } else if (["LIABILITY", "ACCOUNTS_PAYABLE"].includes(account.accountType)) {
      liabilities.push(item)
    } else {
      equity.push(item)
    }
  }

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0)

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity }
}
