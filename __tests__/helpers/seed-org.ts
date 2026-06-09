/**
 * Test seeding helper — builds a fresh organization with a complete chart of
 * accounts, a fiscal year, and a default warehouse, mirroring exactly what
 * app/api/auth/register/route.ts::seedDefaultAccounts produces in production.
 *
 * Used by integration tests that need a real, balanced GL to post against.
 */
import { prisma } from "@/lib/prisma"

export type SeededOrg = {
  orgId: string
  warehouseId: string
  fiscalYearId: string
  /** account code → account id */
  acct: Record<string, string>
}

const GROUPS = [
  { name: "الأصول", code: "1", nature: "DEBIT" as const },
  { name: "الأصول المتداولة", code: "11", nature: "DEBIT" as const, parentName: "الأصول" },
  { name: "الأصول الثابتة", code: "12", nature: "DEBIT" as const, parentName: "الأصول" },
  { name: "الخصوم", code: "2", nature: "CREDIT" as const },
  { name: "الخصوم المتداولة", code: "21", nature: "CREDIT" as const, parentName: "الخصوم" },
  { name: "حقوق الملكية", code: "3", nature: "CREDIT" as const },
  { name: "الإيرادات", code: "4", nature: "CREDIT" as const },
  { name: "المصروفات", code: "5", nature: "DEBIT" as const },
  { name: "مصروفات تشغيلية", code: "51", nature: "DEBIT" as const, parentName: "المصروفات" },
  { name: "مصروفات إدارية", code: "52", nature: "DEBIT" as const, parentName: "المصروفات" },
]

const ACCOUNTS = [
  { code: "1010", name: "الصندوق",                type: "CASH",                nature: "DEBIT",  groupName: "الأصول المتداولة" },
  { code: "1020", name: "البنك",                  type: "BANK",                nature: "DEBIT",  groupName: "الأصول المتداولة" },
  { code: "1110", name: "العملاء",                type: "ACCOUNTS_RECEIVABLE", nature: "DEBIT",  groupName: "الأصول المتداولة" },
  { code: "1120", name: "المخزون",                type: "STOCK",               nature: "DEBIT",  groupName: "الأصول المتداولة" },
  { code: "2110", name: "الموردون",               type: "ACCOUNTS_PAYABLE",    nature: "CREDIT", groupName: "الخصوم المتداولة" },
  { code: "2120", name: "ضريبة القيمة المضافة",   type: "TAX",                 nature: "CREDIT", groupName: "الخصوم المتداولة" },
  { code: "3010", name: "رأس المال",              type: "EQUITY",              nature: "CREDIT", groupName: "حقوق الملكية" },
  { code: "3020", name: "الأرباح المبقاة",        type: "EQUITY",              nature: "CREDIT", groupName: "حقوق الملكية" },
  { code: "4010", name: "المبيعات",               type: "REVENUE",             nature: "CREDIT", groupName: "الإيرادات" },
  { code: "5010", name: "تكلفة البضاعة المباعة", type: "EXPENSE",             nature: "DEBIT",  groupName: "مصروفات تشغيلية" },
]

let counter = 0

/** Create a fully-seeded org. Each call is unique (safe to run many times). */
export async function seedOrg(): Promise<SeededOrg> {
  counter += 1
  const suffix = `${Date.now()}-${counter}`

  const org = await prisma.organization.create({
    data: { name: `Test Org ${suffix}`, slug: `test-org-${suffix}`, country: "IQ", baseCurrency: "IQD" },
  })

  // Groups (respecting parent order)
  const groupIds: Record<string, string> = {}
  for (const g of GROUPS) {
    const parentId = g.parentName ? groupIds[g.parentName] : undefined
    const created = await prisma.accountGroup.create({
      data: { organizationId: org.id, name: g.name, code: g.code, nature: g.nature, parentId, isSystem: true },
    })
    groupIds[g.name] = created.id
  }

  // Accounts
  const acct: Record<string, string> = {}
  for (const a of ACCOUNTS) {
    const created = await prisma.account.create({
      data: {
        organizationId: org.id,
        code: a.code,
        name: a.name,
        accountType: a.type as any,
        nature: a.nature as any,
        groupId: groupIds[a.groupName],
        isSystem: true,
      },
    })
    acct[a.code] = created.id
  }

  // Fiscal year (open) — current calendar year
  const year = new Date().getFullYear()
  const fy = await prisma.fiscalYear.create({
    data: {
      organizationId: org.id,
      name: `السنة المالية ${year}`,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
    },
  })

  const warehouse = await prisma.warehouse.create({
    data: { organizationId: org.id, name: "المستودع الرئيسي", code: "WH-01", isDefault: true },
  })

  return { orgId: org.id, warehouseId: warehouse.id, fiscalYearId: fy.id, acct }
}

/**
 * Wipe all test data. StockLedger has no cascade path from Organization, so a
 * plain org delete would hit FK restrictions — TRUNCATE ... CASCADE is the
 * clean way to reset a dedicated ephemeral test database between runs.
 */
export async function truncateAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "JournalLine", "Journal",
      "StockLedger", "ProductSerial",
      "InvoiceItem", "Invoice",
      "Product", "Warehouse",
      "Account", "AccountGroup",
      "Contact", "FiscalYear",
      "DocumentSequence", "Organization"
    RESTART IDENTITY CASCADE
  `)
}
