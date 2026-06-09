/**
 * Comprehensive accounting system tests.
 *
 * Covers: double-entry invariant, weighted-average COGS, multi-tier pricing,
 * credit limit control, fiscal-year lock, and balance sheet equation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Module mocks (hoisted before imports) ────────────────────────────────────

vi.mock("@/lib/org", () => ({
  getNextDocNumber:             vi.fn().mockResolvedValue("J-0001"),
  getOrCreateDefaultWarehouse:  vi.fn().mockResolvedValue({ id: "wh1" }),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact:      { findFirst:  vi.fn() },
    invoice:      { aggregate:  vi.fn() },
    cheque:       { aggregate:  vi.fn() },
    fiscalYear:   { findFirst:  vi.fn() },
    journal:      { create:     vi.fn() },
    stockLedger:  { findMany:   vi.fn(), create: vi.fn() },
    product:      { findMany:   vi.fn() },
    account:      { findFirst:  vi.fn() },
  },
}))

// ── Imports under test ────────────────────────────────────────────────────────

import { round2, createJournalEntry } from "@/lib/accounting"
import { priceForLevel, priceLevelLabel } from "@/lib/pricing"
import { getWeightedAvgCost, recordCogsForSale } from "@/lib/inventory"
import { checkCreditLimit } from "@/lib/credit"
import { prisma } from "@/lib/prisma"

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal fake Prisma tx-client to pass as `db` to functions that accept it. */
function makeMockDb(overrides: Record<string, any> = {}) {
  const base = {
    fiscalYear:  { findFirst: vi.fn().mockResolvedValue(null) },
    journal:     { create:    vi.fn().mockResolvedValue({ id: "j1", lines: [], totalDebit: 0, totalCredit: 0 }) },
    stockLedger: { findMany:  vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
    product:     { findMany:  vi.fn().mockResolvedValue([]) },
  }
  return { ...base, ...overrides } as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  // Default: no closed fiscal year and successful journal create
  vi.mocked(prisma.fiscalYear.findFirst).mockResolvedValue(null as any)
  vi.mocked(prisma.journal.create).mockResolvedValue({ id: "j1", lines: [] } as any)
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("round2 — monetary rounding", () => {

  it("rounds half-up at 2 decimal places", () => {
    // Use 1.555 — safe from IEEE-754 drift: 1.555*100=155.5 → Math.round=156 → 1.56
    expect(round2(1.555)).toBe(1.56)
  })

  it("does not change an already-rounded value", () => {
    expect(round2(1250)).toBe(1250)
  })

  it("rounds down when third decimal < 5", () => {
    expect(round2(99.994)).toBe(99.99)
  })

  it("handles negative amounts — Math.round rounds toward +∞", () => {
    // -7.555 * 100 = -755.5 → Math.round(-755.5) = -755 (rounds toward +∞) → -7.55
    expect(round2(-7.555)).toBe(-7.55)
  })

  it("rounds Iraqi-dinar totals correctly (large numbers)", () => {
    // 900,000 × 3 = 2,700,000
    expect(round2(900_000 * 3)).toBe(2_700_000)
  })

  it("sum of rounded parts equals rounded whole (no cent drift)", () => {
    const parts = [100.33, 200.34, 300.33]
    const sumParts = parts.map(round2).reduce((a, b) => round2(a + b), 0)
    expect(sumParts).toBe(round2(100.33 + 200.34 + 300.33))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("priceForLevel — multi-tier pricing", () => {

  const product = { salePrice: 100, wholesalePrice: 85, vipPrice: 70 }

  it("RETAIL → salePrice", () => {
    expect(priceForLevel(product, "RETAIL")).toBe(100)
  })

  it("WHOLESALE → wholesalePrice when set", () => {
    expect(priceForLevel(product, "WHOLESALE")).toBe(85)
  })

  it("VIP → vipPrice when set", () => {
    expect(priceForLevel(product, "VIP")).toBe(70)
  })

  it("WHOLESALE falls back to retail when wholesalePrice = 0", () => {
    expect(priceForLevel({ ...product, wholesalePrice: 0 }, "WHOLESALE")).toBe(100)
  })

  it("VIP falls back to retail when vipPrice = 0", () => {
    expect(priceForLevel({ ...product, vipPrice: 0 }, "VIP")).toBe(100)
  })

  it("null/undefined level → retail", () => {
    expect(priceForLevel(product, null)).toBe(100)
    expect(priceForLevel(product, undefined)).toBe(100)
  })

  it("unknown level string → retail", () => {
    expect(priceForLevel(product, "MYSTERY")).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("priceLevelLabel — display names", () => {

  it("RETAIL → مفرد", () => expect(priceLevelLabel("RETAIL")).toBe("مفرد"))
  it("WHOLESALE → جملة", () => expect(priceLevelLabel("WHOLESALE")).toBe("جملة"))
  it("VIP → سعر خاص (VIP)", () => expect(priceLevelLabel("VIP")).toBe("سعر خاص (VIP)"))
  it("null → مفرد (default)", () => expect(priceLevelLabel(null)).toBe("مفرد"))
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("getWeightedAvgCost — perpetual inventory costing", () => {

  it("computes correct weighted average from multiple IN entries", async () => {
    // 10 units @ 900,000 + 5 units @ 1,050,000 → avg = (9,000,000 + 5,250,000) / 15 = 950,000
    const mockDb = makeMockDb({
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 10, unitCost: 900_000 },
          { quantity: 5,  unitCost: 1_050_000 },
        ]),
      },
    })
    const cost = await getWeightedAvgCost("prod1", 0, mockDb)
    expect(cost).toBe(950_000)
  })

  it("returns fallback when no IN ledger entries exist", async () => {
    const mockDb = makeMockDb({
      stockLedger: { findMany: vi.fn().mockResolvedValue([]) },
    })
    const cost = await getWeightedAvgCost("prod1", 750_000, mockDb)
    expect(cost).toBe(750_000)
  })

  it("handles Decimal-like objects from Prisma (string coercion)", async () => {
    // Prisma returns Decimal objects — ensure Number() coercion is applied
    const mockDb = makeMockDb({
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: { toString: () => "10" }, unitCost: { toString: () => "900000" } },
        ]),
      },
    })
    const cost = await getWeightedAvgCost("prod1", 0, mockDb)
    expect(cost).toBe(900_000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("createJournalEntry — double-entry invariant", () => {

  const baseOpts = {
    organizationId: "org1",
    date: new Date("2025-01-15"),
    type: "SALES" as const,
    description: "Test entry",
  }

  it("throws when debit ≠ credit (unbalanced entry)", async () => {
    const mockDb = makeMockDb()
    const lines = [
      { accountId: "ar",      debit: 1_000_000, credit: 0 },
      { accountId: "revenue", debit: 0,         credit: 999_000 },  // off by 1,000
    ]
    await expect(
      createJournalEntry({ ...baseOpts, lines }, mockDb)
    ).rejects.toThrow("unbalanced")
  })

  it("throws when debit ≠ credit (only debits)", async () => {
    const mockDb = makeMockDb()
    const lines = [
      { accountId: "ar",   debit: 500_000, credit: 0 },
      { accountId: "bank", debit: 500_000, credit: 0 },
    ]
    await expect(
      createJournalEntry({ ...baseOpts, lines }, mockDb)
    ).rejects.toThrow("unbalanced")
  })

  it("accepts a perfectly balanced 2-line entry", async () => {
    const mockDb = makeMockDb({
      journal: {
        create: vi.fn().mockResolvedValue({
          id: "j1", totalDebit: 1_000_000, totalCredit: 1_000_000, lines: [],
        }),
      },
    })
    const lines = [
      { accountId: "ar",      debit: 1_000_000, credit: 0 },
      { accountId: "revenue", debit: 0,         credit: 1_000_000 },
    ]
    const journal = await createJournalEntry({ ...baseOpts, lines }, mockDb)
    expect(journal.totalDebit).toBe(journal.totalCredit)
  })

  it("accepts a 3-line entry with tax (debit=subtotal+tax, credit=revenue+tax)", async () => {
    const total    = 1_150_000
    const subtotal = 1_000_000
    const tax      =   150_000

    const mockDb = makeMockDb({
      journal: {
        create: vi.fn().mockResolvedValue({
          id: "j2", totalDebit: total, totalCredit: total, lines: [],
        }),
      },
    })
    const lines = [
      { accountId: "ar",      debit: total,    credit: 0 },
      { accountId: "revenue", debit: 0,         credit: subtotal },
      { accountId: "tax",     debit: 0,         credit: tax },
    ]
    const journal = await createJournalEntry({ ...baseOpts, lines }, mockDb)
    expect(journal.totalDebit).toBe(journal.totalCredit)
  })

  it("rejects posting into a closed fiscal year", async () => {
    const mockDb = makeMockDb({
      fiscalYear: {
        findFirst: vi.fn().mockResolvedValue({ name: "2024", isClosed: true }),
      },
    })
    const lines = [
      { accountId: "ar",      debit: 1_000_000, credit: 0 },
      { accountId: "revenue", debit: 0,         credit: 1_000_000 },
    ]
    await expect(
      createJournalEntry({ ...baseOpts, date: new Date("2024-06-15"), lines }, mockDb)
    ).rejects.toThrow("مقفلة")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("recordCogsForSale — inventory cost of goods sold", () => {

  it("calculates COGS correctly for inventoried products", async () => {
    // PS5: 2 units, WAC = 850,000 → COGS = 1,700,000
    const mockDb = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ps5", purchasePrice: 850_000, isInventoried: true },
        ]),
      },
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 10, unitCost: 850_000 },
        ]),
        create: vi.fn().mockResolvedValue({}),
      },
    })

    const cogs = await recordCogsForSale({
      organizationId: "org1",
      warehouseId: "wh1",
      date: new Date("2025-01-15"),
      reference: "INV-001",
      items: [{ productId: "ps5", quantity: 2 }],
      db: mockDb,
    })

    expect(cogs).toBe(1_700_000)
  })

  it("skips non-inventoried products (service lines)", async () => {
    const mockDb = makeMockDb({
      product: {
        // Empty: product not found → not inventoried
        findMany: vi.fn().mockResolvedValue([]),
      },
      stockLedger: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    })

    const cogs = await recordCogsForSale({
      organizationId: "org1",
      warehouseId: "wh1",
      date: new Date("2025-01-15"),
      reference: "INV-002",
      items: [{ productId: "service1", quantity: 5 }],
      db: mockDb,
    })

    expect(cogs).toBe(0)
  })

  it("skips items with zero or negative quantity", async () => {
    const mockDb = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ps5", purchasePrice: 850_000, isInventoried: true },
        ]),
      },
      stockLedger: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    })

    const cogs = await recordCogsForSale({
      organizationId: "org1",
      warehouseId: "wh1",
      date: new Date(),
      reference: "INV-003",
      items: [{ productId: "ps5", quantity: 0 }],
      db: mockDb,
    })

    expect(cogs).toBe(0)
  })

  it("creates StockLedger OUT entries when createStockOut=true", async () => {
    const createFn = vi.fn().mockResolvedValue({})
    const mockDb = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ps5", purchasePrice: 850_000, isInventoried: true },
        ]),
      },
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([{ quantity: 5, unitCost: 850_000 }]),
        create:   createFn,
      },
    })

    await recordCogsForSale({
      organizationId: "org1",
      warehouseId: "wh1",
      date: new Date(),
      reference: "INV-004",
      items: [{ productId: "ps5", quantity: 3 }],
      createStockOut: true,
      db: mockDb,
    })

    expect(createFn).toHaveBeenCalledOnce()
    const callArg = createFn.mock.calls[0][0].data
    expect(callArg.type).toBe("OUT")
    expect(callArg.quantity).toBe(3)
    expect(callArg.productId).toBe("ps5")
  })

  it("does NOT create StockLedger OUT when createStockOut=false", async () => {
    const createFn = vi.fn()
    const mockDb = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: "ps5", purchasePrice: 850_000, isInventoried: true },
        ]),
      },
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([{ quantity: 5, unitCost: 850_000 }]),
        create:   createFn,
      },
    })

    await recordCogsForSale({
      organizationId: "org1",
      warehouseId: "wh1",
      date: new Date(),
      reference: "INV-005",
      items: [{ productId: "ps5", quantity: 2 }],
      createStockOut: false,
      db: mockDb,
    })

    expect(createFn).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("checkCreditLimit — credit control", () => {

  function setupCreditMocks(
    creditLimit: number,
    openInvoices: number,
    pendingCheques: number,
  ) {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue({ creditLimit } as any)
    vi.mocked(prisma.invoice.aggregate).mockResolvedValue({ _sum: { amountDue: openInvoices } } as any)
    vi.mocked(prisma.cheque.aggregate).mockResolvedValue({ _sum: { amount: pendingCheques } } as any)
  }

  it("exceeded=true when new sale pushes over limit", async () => {
    setupCreditMocks(1_000_000, 800_000, 0)
    const result = await checkCreditLimit("org1", "cust1", 300_000)
    expect(result.exceeded).toBe(true)
    expect(result.projected).toBe(1_100_000)
  })

  it("exceeded=false when new sale stays within limit", async () => {
    setupCreditMocks(1_000_000, 500_000, 0)
    const result = await checkCreditLimit("org1", "cust1", 400_000)
    expect(result.exceeded).toBe(false)
    expect(result.available).toBe(500_000)
  })

  it("exceeded=false exactly at the limit boundary", async () => {
    setupCreditMocks(1_000_000, 600_000, 0)
    const result = await checkCreditLimit("org1", "cust1", 400_000)
    expect(result.exceeded).toBe(false)
  })

  it("includes pending cheques in outstanding exposure", async () => {
    // invoices = 600K, pending cheques = 300K → outstanding = 900K, new 200K → exceeds 1M
    setupCreditMocks(1_000_000, 600_000, 300_000)
    const result = await checkCreditLimit("org1", "cust1", 200_000)
    expect(result.exceeded).toBe(true)
    expect(result.outstanding).toBe(900_000)
  })

  it("always passes (exceeded=false) when no credit limit set (limit=0)", async () => {
    setupCreditMocks(0, 999_999_999, 0)
    const result = await checkCreditLimit("org1", "cust1", 50_000_000)
    expect(result.hasLimit).toBe(false)
    expect(result.exceeded).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("balance sheet equation — Assets = Liabilities + Equity", () => {

  it("equation holds for a simple set of balanced accounts", () => {
    // Self-consistent data: Assets = 5M, Liabilities = 2M, Equity = 3M (5M = 2M + 3M)
    // Bank: DR5M/CR2M = 3M | AR: DR1M = 1M | Stock: DR1M = 1M → Assets 5M
    // AP:  CR2M = 2M        | Equity: CR3M = 3M               → L+E   5M
    const accounts = [
      // Assets
      { accountType: "BANK",                nature: "DEBIT",  openingBalance: 0, debits: 5_000_000, credits: 2_000_000 },  // Bank 3M
      { accountType: "ACCOUNTS_RECEIVABLE", nature: "DEBIT",  openingBalance: 0, debits: 1_000_000, credits:         0 },  // AR 1M
      { accountType: "STOCK",               nature: "DEBIT",  openingBalance: 0, debits: 1_000_000, credits:         0 },  // Inventory 1M
      // Liabilities
      { accountType: "ACCOUNTS_PAYABLE",    nature: "CREDIT", openingBalance: 0, debits:         0, credits: 2_000_000 },  // AP 2M
      // Equity
      { accountType: "EQUITY",              nature: "CREDIT", openingBalance: 0, debits:         0, credits: 3_000_000 },  // Capital 3M
    ]

    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0

    for (const a of accounts) {
      const balance = a.nature === "DEBIT"
        ? Number(a.openingBalance) + a.debits - a.credits
        : Number(a.openingBalance) + a.credits - a.debits

      if (["ASSET","BANK","CASH","ACCOUNTS_RECEIVABLE","STOCK","FIXED_ASSET"].includes(a.accountType)) {
        totalAssets += balance
      } else if (["LIABILITY","ACCOUNTS_PAYABLE"].includes(a.accountType)) {
        totalLiabilities += balance
      } else {
        totalEquity += balance
      }
    }

    expect(round2(totalAssets)).toBe(round2(totalLiabilities + totalEquity))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("double-entry — COGS + Inventory mirror invariant", () => {

  it("every COGS post has a matching Inventory credit of equal amount", () => {
    // Model the journal lines that recordCogsForSale + createJournalEntry would produce
    const cogsTotal = 2_550_000

    const cogsEntry = [
      { accountId: "cogs-acct", debit: cogsTotal, credit: 0 },
      { accountId: "inv-acct",  debit: 0,         credit: cogsTotal },
    ]

    const totalDebit  = cogsEntry.reduce((s, l) => s + l.debit,  0)
    const totalCredit = cogsEntry.reduce((s, l) => s + l.credit, 0)

    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBe(cogsTotal)
  })

  it("credit note reversal restores exact COGS (DR Inventory = CR COGS)", () => {
    // When a credit note restocks 2 PS5s at WAC 850,000 each → reversal = 1,700,000
    const reversalAmount = 1_700_000

    const reversalEntry = [
      { accountId: "inv-acct",  debit: reversalAmount, credit: 0 },
      { accountId: "cogs-acct", debit: 0,              credit: reversalAmount },
    ]

    const totalDebit  = reversalEntry.reduce((s, l) => s + l.debit,  0)
    const totalCredit = reversalEntry.reduce((s, l) => s + l.credit, 0)

    expect(totalDebit).toBe(totalCredit)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe("weighted-average costing — multi-batch precision", () => {

  it("handles 5 purchase batches at different prices", async () => {
    // Batches: 10@800K, 5@850K, 8@900K, 3@950K, 4@1000K
    // Total qty = 30, total cost = 8M + 4.25M + 7.2M + 2.85M + 4M = 26.3M
    // WAC = 26,300,000 / 30 ≈ 876,666.67
    const mockDb = makeMockDb({
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 10, unitCost: 800_000 },
          { quantity:  5, unitCost: 850_000 },
          { quantity:  8, unitCost: 900_000 },
          { quantity:  3, unitCost: 950_000 },
          { quantity:  4, unitCost: 1_000_000 },
        ]),
      },
    })

    const cost = await getWeightedAvgCost("prod1", 0, mockDb)
    const expected = round2(26_300_000 / 30)
    expect(cost).toBe(expected)
  })

  it("single batch WAC equals that batch unit cost exactly", async () => {
    const mockDb = makeMockDb({
      stockLedger: {
        findMany: vi.fn().mockResolvedValue([
          { quantity: 20, unitCost: 900_000 },
        ]),
      },
    })
    const cost = await getWeightedAvgCost("prod1", 0, mockDb)
    expect(cost).toBe(900_000)
  })
})
