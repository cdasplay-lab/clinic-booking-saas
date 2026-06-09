/**
 * INTEGRATION TEST — full accounting cycle against a real PostgreSQL database.
 *
 * Unlike the unit tests (which mock Prisma), this drives the *real* accounting
 * engine — createJournalEntry, recordCogsForSale, getWeightedAvgCost,
 * getTrialBalance, getBalanceSheet, getProfitAndLoss — against live tables and
 * verifies the books stay internally consistent after every single step:
 *
 *   • Trial balance: Σ debits  ==  Σ credits        (double-entry invariant)
 *   • Balance sheet: Assets    ==  Liabilities + Equity + period P&L
 *
 * Scenario (PlayStation retailer, Iraqi dinar):
 *   0. Open the books      — DR Cash / CR Capital
 *   1. Buy 10 × PS5 on credit @ 850,000   — DR Inventory / CR Suppliers
 *   2. Sell 2 × PS5 on credit @ 1,000,000 — AR/Revenue/VAT + COGS/Inventory
 *   3. Customer returns 1 (credit note)   — reverse revenue + COGS + restock
 *   4. Collect the receivable             — DR Cash / CR Customers
 *
 * If any posting is wrong, the invariant assertions fail loudly.
 */
import "dotenv/config"
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

// lib/org.ts (pulled in by createJournalEntry → getNextDocNumber) imports
// lib/auth → next-auth → next/server, which doesn't resolve under the node
// test runner. We never authenticate here, so stub it out.
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }))

import { prisma } from "@/lib/prisma"
import {
  createJournalEntry,
  getTrialBalance,
  getBalanceSheet,
  getProfitAndLoss,
} from "@/lib/accounting"
import { recordCogsForSale, getWeightedAvgCost } from "@/lib/inventory"
import { seedOrg, truncateAll, type SeededOrg } from "../helpers/seed-org"

// ── Invariant assertions ──────────────────────────────────────────────────────

async function assertTrialBalanceBalanced(orgId: string, label: string) {
  const tb = await getTrialBalance(orgId)
  const totalDebit = tb.reduce((s, a) => s + a.debit, 0)
  const totalCredit = tb.reduce((s, a) => s + a.credit, 0)
  expect.soft(Math.round(totalDebit), `[${label}] trial balance Σdebit==Σcredit`)
    .toBe(Math.round(totalCredit))
  return tb
}

async function assertBalanceSheetBalanced(orgId: string, label: string) {
  const now = new Date()
  const bs = await getBalanceSheet(orgId, now)
  const pl = await getProfitAndLoss(
    orgId,
    new Date(now.getFullYear(), 0, 1),
    now,
  )
  // Equity on the balance sheet does NOT include current-period net profit
  // (it lives in revenue/expense nominal accounts until year-end close), so the
  // accounting equation here is: Assets = Liabilities + Equity + NetProfit.
  const rhs = bs.totalLiabilities + bs.totalEquity + pl.netProfit
  expect.soft(Math.round(bs.totalAssets), `[${label}] Assets == L + E + P&L`)
    .toBe(Math.round(rhs))
  return { bs, pl }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let org: SeededOrg
let ps5Id: string
const TODAY = new Date()
const PS5_COST = 850_000
const PS5_PRICE = 1_000_000

// Integration tests need a real database. When DATABASE_URL is absent (e.g. a
// CI lane without Postgres) the whole suite is skipped instead of failing.
const hasDb = !!process.env.DATABASE_URL

// ══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!hasDb)("Full accounting cycle (real DB)", () => {

  beforeAll(async () => {
    await truncateAll()
    org = await seedOrg()

    const ps5 = await prisma.product.create({
      data: {
        organizationId: org.orgId,
        code: "PS5-STD",
        name: "PlayStation 5",
        salePrice: PS5_PRICE,
        purchasePrice: PS5_COST,
        isInventoried: true,
        tracksSerial: false,
      },
    })
    ps5Id = ps5.id
  })

  afterAll(async () => {
    await truncateAll()
    await prisma.$disconnect()
  })

  it("Step 0 — opening entry: DR Cash / CR Capital, books balanced", async () => {
    const capital = 50_000_000
    await createJournalEntry({
      organizationId: org.orgId,
      date: TODAY,
      type: "OPENING",
      description: "افتتاح رأس المال",
      lines: [
        { accountId: org.acct["1010"], debit: capital, credit: 0 },        // Cash
        { accountId: org.acct["3010"], debit: 0,        credit: capital }, // Capital
      ],
    })

    const tb = await assertTrialBalanceBalanced(org.orgId, "open")
    await assertBalanceSheetBalanced(org.orgId, "open")

    const cash = tb.find((a) => a.accountCode === "1010")!
    const cap = tb.find((a) => a.accountCode === "3010")!
    expect(cash.balance).toBe(capital)
    expect(cap.balance).toBe(capital)
  })

  it("Step 1 — purchase 10×PS5 on credit: Inventory up, Suppliers up", async () => {
    const qty = 10
    const cost = qty * PS5_COST // 8,500,000

    await prisma.$transaction(async (tx) => {
      await createJournalEntry({
        organizationId: org.orgId,
        date: TODAY,
        type: "PURCHASE",
        description: "شراء 10 أجهزة PS5",
        lines: [
          { accountId: org.acct["1120"], debit: cost, credit: 0 },   // Inventory
          { accountId: org.acct["2110"], debit: 0,    credit: cost }, // Suppliers
        ],
      }, tx)

      await tx.stockLedger.create({
        data: {
          productId: ps5Id,
          warehouseId: org.warehouseId,
          date: TODAY,
          reference: "PURCHASE-1",
          quantity: qty,
          unitCost: PS5_COST,
          type: "IN",
        },
      })
    })

    const tb = await assertTrialBalanceBalanced(org.orgId, "purchase")
    await assertBalanceSheetBalanced(org.orgId, "purchase")

    const inv = tb.find((a) => a.accountCode === "1120")!
    const ap = tb.find((a) => a.accountCode === "2110")!
    expect(inv.balance).toBe(cost)
    expect(ap.balance).toBe(cost)

    // Weighted-average cost from the single batch == unit cost
    const wac = await getWeightedAvgCost(ps5Id, PS5_COST)
    expect(wac).toBe(PS5_COST)
  })

  it("Step 2 — sell 2×PS5 on credit with VAT + COGS, gross profit correct", async () => {
    const qty = 2
    const subtotal = qty * PS5_PRICE // 2,000,000
    const vat = Math.round(subtotal * 0.0)  // Iraq retail: model VAT-free here
    const total = subtotal + vat

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          organizationId: org.orgId,
          contactId: (await tx.contact.create({
            data: { organizationId: org.orgId, name: "عميل نقدي", type: "CUSTOMER" },
          })).id,
          number: "INV-TEST-1",
          date: TODAY,
          dueDate: TODAY,
          subtotal,
          taxAmount: vat,
          total,
          amountDue: total,
          status: "SENT",
          arAccountId: org.acct["1110"],
          items: {
            create: [{
              productId: ps5Id,
              description: "PlayStation 5",
              quantity: qty,
              unitPrice: PS5_PRICE,
              total: subtotal,
            }],
          },
        },
      })

      // AR + Revenue journal (mirrors app/api/invoices/route.ts)
      await createJournalEntry({
        organizationId: org.orgId,
        date: TODAY,
        type: "SALES",
        description: `فاتورة ${inv.number}`,
        sourceType: "invoice",
        sourceId: inv.id,
        lines: [
          { accountId: org.acct["1110"], debit: total, credit: 0 },        // AR
          { accountId: org.acct["4010"], debit: 0,     credit: subtotal }, // Revenue
        ],
      }, tx)

      // COGS journal + stock OUT via the real engine
      const cogs = await recordCogsForSale({
        organizationId: org.orgId,
        warehouseId: org.warehouseId,
        date: TODAY,
        reference: inv.number,
        items: [{ productId: ps5Id, quantity: qty }],
        db: tx,
      })
      expect(cogs).toBe(qty * PS5_COST) // 1,700,000

      await createJournalEntry({
        organizationId: org.orgId,
        date: TODAY,
        type: "SALES",
        description: `تكلفة بضاعة — ${inv.number}`,
        sourceType: "invoice-cogs",
        sourceId: inv.id,
        lines: [
          { accountId: org.acct["5010"], debit: cogs, credit: 0 },   // COGS
          { accountId: org.acct["1120"], debit: 0,    credit: cogs }, // Inventory
        ],
      }, tx)

      return inv
    })

    expect(invoice.id).toBeTruthy()

    const tb = await assertTrialBalanceBalanced(org.orgId, "sale")
    const { pl } = await assertBalanceSheetBalanced(org.orgId, "sale")

    // Gross profit = revenue − COGS = 2,000,000 − 1,700,000 = 300,000
    expect(pl.totalRevenue).toBe(subtotal)
    expect(pl.totalExpenses).toBe(qty * PS5_COST)
    expect(pl.netProfit).toBe(subtotal - qty * PS5_COST)

    // Inventory reduced to 8 units' worth = 8 × 850,000 = 6,800,000
    const inv = tb.find((a) => a.accountCode === "1120")!
    expect(inv.balance).toBe(8 * PS5_COST)

    // AR reflects the full receivable
    const ar = tb.find((a) => a.accountCode === "1110")!
    expect(ar.balance).toBe(total)
  })

  it("Step 3 — credit note returns 1×PS5: reverse revenue + COGS + restock", async () => {
    const qty = 1
    const refundSubtotal = qty * PS5_PRICE // 1,000,000
    const cogsReversal = qty * PS5_COST    // 850,000

    await prisma.$transaction(async (tx) => {
      // Reverse AR + Revenue (DR Revenue / CR AR)
      await createJournalEntry({
        organizationId: org.orgId,
        date: TODAY,
        type: "CREDIT_NOTE",
        description: "إشعار خصم — إرجاع جهاز",
        lines: [
          { accountId: org.acct["4010"], debit: refundSubtotal, credit: 0 },            // Revenue down
          { accountId: org.acct["1110"], debit: 0,              credit: refundSubtotal }, // AR down
        ],
      }, tx)

      // Reverse COGS (DR Inventory / CR COGS) + restock
      await createJournalEntry({
        organizationId: org.orgId,
        date: TODAY,
        type: "CREDIT_NOTE",
        description: "عكس تكلفة البضاعة",
        lines: [
          { accountId: org.acct["1120"], debit: cogsReversal, credit: 0 },             // Inventory up
          { accountId: org.acct["5010"], debit: 0,            credit: cogsReversal },   // COGS down
        ],
      }, tx)

      await tx.stockLedger.create({
        data: {
          productId: ps5Id,
          warehouseId: org.warehouseId,
          date: TODAY,
          reference: "CN-TEST-1",
          quantity: qty,
          unitCost: PS5_COST,
          type: "IN",
        },
      })
    })

    const tb = await assertTrialBalanceBalanced(org.orgId, "credit-note")
    const { pl } = await assertBalanceSheetBalanced(org.orgId, "credit-note")

    // After returning 1 of 2 sold: net sale is 1 unit
    // Revenue net = 1,000,000 ; COGS net = 850,000 ; profit = 150,000
    expect(pl.totalRevenue).toBe(PS5_PRICE)
    expect(pl.totalExpenses).toBe(PS5_COST)
    expect(pl.netProfit).toBe(PS5_PRICE - PS5_COST)

    // Inventory back up to 9 units = 9 × 850,000 = 7,650,000
    const inv = tb.find((a) => a.accountCode === "1120")!
    expect(inv.balance).toBe(9 * PS5_COST)

    // AR reduced by the refund: 2,000,000 − 1,000,000 = 1,000,000
    const ar = tb.find((a) => a.accountCode === "1110")!
    expect(ar.balance).toBe(PS5_PRICE)
  })

  it("Step 4 — collect receivable: DR Cash / CR Customers, AR cleared", async () => {
    const collected = PS5_PRICE // 1,000,000 remaining

    await createJournalEntry({
      organizationId: org.orgId,
      date: TODAY,
      type: "RECEIPT",
      description: "تحصيل من العميل",
      lines: [
        { accountId: org.acct["1010"], debit: collected, credit: 0 },        // Cash up
        { accountId: org.acct["1110"], debit: 0,         credit: collected }, // AR down
      ],
    })

    const tb = await assertTrialBalanceBalanced(org.orgId, "collect")
    await assertBalanceSheetBalanced(org.orgId, "collect")

    // AR fully cleared
    const ar = tb.find((a) => a.accountCode === "1110")
    expect(ar ? ar.balance : 0).toBe(0)

    // Cash = opening 50,000,000 + collected 1,000,000 = 51,000,000
    const cash = tb.find((a) => a.accountCode === "1010")!
    expect(cash.balance).toBe(50_000_000 + collected)
  })

  it("Final — books fully consistent after the whole cycle", async () => {
    const tb = await assertTrialBalanceBalanced(org.orgId, "final")
    const { bs, pl } = await assertBalanceSheetBalanced(org.orgId, "final")

    // Net profit for the period: sold 1 PS5 net @ 150,000 margin
    expect(pl.netProfit).toBe(PS5_PRICE - PS5_COST)

    // Suppliers still owed the full purchase (not paid in this cycle)
    const ap = tb.find((a) => a.accountCode === "2110")!
    expect(ap.balance).toBe(10 * PS5_COST)

    // Sanity: assets are positive and equation holds
    expect(bs.totalAssets).toBeGreaterThan(0)
  })
})
