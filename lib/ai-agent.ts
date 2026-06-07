import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCurrency } from "./utils"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "./org"
import { createJournalEntry, round2 } from "./accounting"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL CONTEXT  — rich data snapshot fed into system prompt
// ─────────────────────────────────────────────────────────────────────────────
export async function getFinancialContext(organizationId: string) {
  const now              = new Date()
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfYear      = new Date(now.getFullYear(), 0, 1)
  const startOfWeek      = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfLastWeek  = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  const endOfLastWeek    = new Date(startOfWeek); endOfLastWeek.setDate(startOfWeek.getDate() - 1)

  const [
    weekRev, weekExp, lwRev, lwExp,
    monthRev, monthExp, lmRev, lmExp,
    ytdRev, ytdExp,
    cashAccounts,
    totalSalaries,
    overdueInvoices, overdueBills,
    topExpenses, topRevenues,
    recentJournals,
    employeesCount,
    lowStockProducts,
    topCustomers,
    inventoryValue,
    unpaidInvoices30, unpaidInvoices60, unpaidInvoices90,
  ] = await Promise.all([
    // Revenue & Expenses — week
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    // Month
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    // YTD
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    // Cash
    prisma.account.findMany({ where: { organizationId, accountType: { in: ["CASH", "BANK"] } }, include: { journalLines: { where: { journal: { status: "POSTED" } } } } }),
    prisma.employee.aggregate({ where: { organizationId, isActive: true }, _sum: { basicSalary: true } }),
    // AR/AP overdue
    prisma.invoice.findMany({ where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } }, include: { contact: true }, orderBy: { amountDue: "desc" }, take: 10 }),
    prisma.bill.findMany({ where: { organizationId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } }, include: { contact: true }, orderBy: { amountDue: "desc" }, take: 10 }),
    // Top expense & revenue accounts YTD
    prisma.account.findMany({ where: { organizationId, accountType: "EXPENSE" }, include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } } }),
    prisma.account.findMany({ where: { organizationId, accountType: "REVENUE" }, include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } } }),
    prisma.journal.findMany({ where: { organizationId }, orderBy: { date: "desc" }, take: 8 }),
    prisma.employee.count({ where: { organizationId, isActive: true } }),
    // Low stock products
    prisma.product.findMany({ where: { organizationId, isActive: true, isInventoried: true }, include: { stockLedger: true }, take: 50 }),
    // Top customers by revenue YTD
    prisma.invoice.groupBy({ by: ["contactId"], where: { organizationId, status: { in: ["SENT", "PARTIAL", "PAID"] }, date: { gte: startOfYear } }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 5 }),
    // Inventory value
    prisma.product.findMany({ where: { organizationId, isActive: true, isInventoried: true }, include: { stockLedger: true }, take: 200 }),
    // AR aging buckets
    prisma.invoice.findMany({ where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { gte: new Date(now.getTime() - 30 * 86400000), lt: now } }, select: { amountDue: true } }),
    prisma.invoice.findMany({ where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { gte: new Date(now.getTime() - 60 * 86400000), lt: new Date(now.getTime() - 30 * 86400000) } }, select: { amountDue: true } }),
    prisma.invoice.findMany({ where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: new Date(now.getTime() - 60 * 86400000) } }, select: { amountDue: true } }),
  ])

  // Cash balance
  const cashBalance = cashAccounts.reduce((t, a) => {
    const bal = a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
    return t + bal
  }, 0)

  const monthlySalaries = Number(totalSalaries._sum.basicSalary || 0)

  // Revenue/expense numbers
  const wR  = Number(weekRev._sum.credit   || 0); const wE  = Number(weekExp._sum.debit   || 0)
  const lwR = Number(lwRev._sum.credit     || 0); const lwE = Number(lwExp._sum.debit     || 0)
  const mR  = Number(monthRev._sum.credit  || 0); const mE  = Number(monthExp._sum.debit  || 0)
  const lmR = Number(lmRev._sum.credit     || 0); const lmE = Number(lmExp._sum.debit     || 0)
  const yR  = Number(ytdRev._sum.credit    || 0); const yE  = Number(ytdExp._sum.debit    || 0)

  const pct = (a: number, b: number) => b > 0 ? `${((a - b) / b * 100).toFixed(1)}%` : "—"

  // Expense & revenue breakdowns
  const expBreak = topExpenses
    .map((a) => ({ name: a.name, amt: a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) }))
    .filter((a) => a.amt > 0).sort((a, b) => b.amt - a.amt).slice(0, 6)

  const revBreak = topRevenues
    .map((a) => ({ name: a.name, amt: a.journalLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0) }))
    .filter((a) => a.amt > 0).sort((a, b) => b.amt - a.amt).slice(0, 5)

  // Low stock
  const calcStock = (p: typeof lowStockProducts[0]) =>
    p.stockLedger.reduce((s, l) => {
      if (l.type === "IN") return s + Number(l.quantity)
      if (l.type === "OUT") return s - Number(l.quantity)
      if (l.type === "ADJUSTMENT") return s + Number(l.quantity)
      return s
    }, 0)
  const lowStock = lowStockProducts.filter((p) => calcStock(p) <= Number(p.reorderLevel))

  // Inventory total value
  const invValue = inventoryValue.reduce((s, p) => s + calcStock(p) * Number(p.purchasePrice), 0)

  // AR aging
  const ar30 = unpaidInvoices30.reduce((s, i) => s + Number(i.amountDue), 0)
  const ar60 = unpaidInvoices60.reduce((s, i) => s + Number(i.amountDue), 0)
  const ar90 = unpaidInvoices90.reduce((s, i) => s + Number(i.amountDue), 0)

  // Top customers — need contact names
  const topCustomerIds = topCustomers.map((c) => c.contactId)
  const customerNames  = topCustomerIds.length
    ? await prisma.contact.findMany({ where: { id: { in: topCustomerIds } }, select: { id: true, name: true } })
    : []
  const nameMap = Object.fromEntries(customerNames.map((c) => [c.id, c.name]))

  // Cash runway
  const runway = monthlySalaries > 0 ? (cashBalance / monthlySalaries).toFixed(1) : "—"

  // Gross margin estimate (YTD)
  const cogs = expBreak.find((e) => e.name.includes("تكلفة") || e.name.toLowerCase().includes("cogs"))?.amt || 0
  const grossMargin = yR > 0 ? (((yR - cogs) / yR) * 100).toFixed(1) : "—"

  return `
═══════════════════════════════════════
📊 لوحة البيانات المالية — ${now.toLocaleDateString("ar-SA")}
═══════════════════════════════════════

💰 الوضع النقدي الفوري
• الرصيد: ${formatCurrency(cashBalance)}
• الرواتب الشهرية: ${formatCurrency(monthlySalaries)}
• أشهر الكاش المتبقية: ${runway} شهر
${cashBalance < monthlySalaries ? "🔴 تحذير حرج: الرصيد لا يكفي لدفع رواتب الشهر القادم!" : cashBalance < monthlySalaries * 2 ? "🟡 تنبيه: الرصيد يكفي شهرين فقط" : "🟢 الوضع النقدي مريح"}

📈 الأداء — هذا الأسبوع
• الإيرادات: ${formatCurrency(wR)} (${pct(wR, lwR)} مقارنة الأسبوع الماضي)
• المصروفات: ${formatCurrency(wE)} (${pct(wE, lwE)})
• الصافي: ${formatCurrency(wR - wE)}

📅 الأداء — هذا الشهر
• الإيرادات: ${formatCurrency(mR)} (${pct(mR, lmR)} مقارنة الشهر الماضي)
• المصروفات: ${formatCurrency(mE)} (${pct(mE, lmE)})
• الصافي: ${formatCurrency(mR - mE)} | هامش: ${mR > 0 ? ((mR - mE) / mR * 100).toFixed(1) : 0}%

📆 السنة حتى الآن
• إيرادات: ${formatCurrency(yR)} | مصروفات: ${formatCurrency(yE)}
• الربح الصافي: ${formatCurrency(yR - yE)} | الهامش: ${yR > 0 ? ((yR - yE) / yR * 100).toFixed(1) : 0}%
${grossMargin !== "—" ? `• هامش المبيعات (بعد التكلفة): ${grossMargin}%` : ""}

📦 قيمة المخزون: ${formatCurrency(invValue)}
${lowStock.length > 0 ? `⚠️ منتجات منخفضة المخزون (${lowStock.length}): ${lowStock.slice(0, 5).map((p) => `${p.name} (${calcStock(p)} ${p.unit})`).join(", ")}` : "✅ المخزون كافٍ"}

👥 أكبر العملاء هذا العام:
${topCustomers.slice(0, 5).map((c, i) => `${i + 1}. ${nameMap[c.contactId] || "—"}: ${formatCurrency(Number(c._sum.total))}`).join("\n") || "لا بيانات"}

📤 ذمم مدينة متأخرة (AR)
• 1-30 يوم: ${formatCurrency(ar30)} (${unpaidInvoices30.length} فاتورة)
• 31-60 يوم: ${formatCurrency(ar60)} (${unpaidInvoices60.length} فاتورة)
• +60 يوم: ${formatCurrency(ar90)} (${unpaidInvoices90.length} فاتورة) ${ar90 > 0 ? "⚠️ مخاطر تحصيل!" : ""}
${overdueInvoices.slice(0, 5).map((i) => `  → ${i.contact.name}: ${formatCurrency(Number(i.amountDue))} (استحق ${i.dueDate.toLocaleDateString("ar-SA")})`).join("\n")}

📥 ذمم دائنة متأخرة (AP) — ${overdueBills.length} فاتورة مورد
${overdueBills.slice(0, 5).map((b) => `  → ${b.contact.name}: ${formatCurrency(Number(b.amountDue))}`).join("\n") || "  لا يوجد"}

💼 هيكل المصروفات (YTD):
${expBreak.map((e) => `• ${e.name}: ${formatCurrency(e.amt)} (${yE > 0 ? ((e.amt / yE) * 100).toFixed(1) : 0}%)`).join("\n") || "لا بيانات"}

📊 مصادر الإيرادات (YTD):
${revBreak.map((r) => `• ${r.name}: ${formatCurrency(r.amt)}`).join("\n") || "لا بيانات"}

👷 الموارد البشرية: ${employeesCount} موظف | رواتب: ${formatCurrency(monthlySalaries)}/شهر

🗒️ آخر العمليات:
${recentJournals.map((j) => `• ${j.date.toLocaleDateString("ar-SA")} | ${j.number} | ${j.description}`).join("\n")}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_invoice",
    description: "ينشئ فاتورة بيع للعميل. استخدم عند طلب تسجيل بيع أو فاتورة عميل.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactName: { type: "string", description: "اسم العميل" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity:    { type: "number" },
              unitPrice:   { type: "number" },
            },
            required: ["description", "quantity", "unitPrice"],
          },
        },
        dueDate: { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD (اختياري، افتراضي 30 يوم)" },
        notes:   { type: "string" },
      },
      required: ["contactName", "items"],
    },
  },
  {
    name: "create_bill",
    description: "ينشئ فاتورة مورد (مشتريات). استخدم عند تسجيل فاتورة من مورد أو شراء بضاعة.",
    input_schema: {
      type: "object" as const,
      properties: {
        vendorName: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity:    { type: "number" },
              unitPrice:   { type: "number" },
            },
            required: ["description", "quantity", "unitPrice"],
          },
        },
        dueDate: { type: "string", description: "YYYY-MM-DD" },
        notes:   { type: "string" },
      },
      required: ["vendorName", "items"],
    },
  },
  {
    name: "record_payment",
    description: "يسجل دفعة على فاتورة عميل أو مورد. استخدم عند وصول دفعة من عميل أو دفع مبلغ لمورد.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactName: { type: "string", description: "اسم العميل أو المورد" },
        amount:      { type: "number", description: "المبلغ المدفوع" },
        type:        { type: "string", enum: ["INCOMING", "OUTGOING"], description: "INCOMING = من عميل، OUTGOING = لمورد" },
        method:      { type: "string", enum: ["CASH", "BANK_TRANSFER", "CHECK"], description: "طريقة الدفع" },
        invoiceNumber: { type: "string", description: "رقم الفاتورة المحددة (اختياري)" },
        notes:       { type: "string" },
      },
      required: ["contactName", "amount", "type"],
    },
  },
  {
    name: "create_journal_entry",
    description: "ينشئ قيد يومية يدوي. استخدم للمصروفات النقدية والتسويات والقيود المخصصة.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "وصف العملية" },
        lines: {
          type: "array",
          description: "سطور القيد — مجموع المدين = مجموع الدائن",
          items: {
            type: "object",
            properties: {
              accountName: { type: "string", description: "اسم الحساب (جزئي يكفي)" },
              debit:       { type: "number", description: "مدين" },
              credit:      { type: "number", description: "دائن" },
            },
            required: ["accountName"],
          },
        },
        date: { type: "string", description: "YYYY-MM-DD (اليوم إذا فارغ)" },
      },
      required: ["description", "lines"],
    },
  },
  {
    name: "get_customer_statement",
    description: "يجلب كشف حساب عميل أو مورد: الفواتير المفتوحة والمدفوعة وإجمالي الرصيد.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactName: { type: "string", description: "اسم العميل أو المورد" },
        type:        { type: "string", enum: ["CUSTOMER", "VENDOR"], description: "نوع جهة الاتصال" },
      },
      required: ["contactName"],
    },
  },
  {
    name: "get_profit_analysis",
    description: "يحلل الربحية حسب المنتج أو الفئة. يحسب هامش الربح الإجمالي لكل منتج.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["month", "quarter", "year"], description: "الفترة الزمنية" },
        topN:   { type: "number", description: "عدد المنتجات للعرض (افتراضي 10)" },
      },
      required: [],
    },
  },
  {
    name: "check_stock",
    description: "يفحص الكمية الحالية لمنتج معين في المخزون.",
    input_schema: {
      type: "object" as const,
      properties: {
        productName: { type: "string", description: "اسم المنتج أو كوده أو باركوده" },
      },
      required: ["productName"],
    },
  },
  {
    name: "search_products",
    description: "يبحث عن منتجات ويعرض أسعارها وتفاصيلها.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_contacts",
    description: "يبحث عن عملاء أو موردين.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        type:  { type: "string", enum: ["CUSTOMER", "VENDOR", "BOTH"] },
      },
      required: ["query"],
    },
  },
  {
    name: "get_cash_flow_forecast",
    description: "يتوقع التدفق النقدي للـ 30 يوم القادمة بناءً على الفواتير المفتوحة ومواعيد استحقاقها.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_pos_summary",
    description: "يجلب ملخص مبيعات نقطة البيع ليوم معين.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (اليوم إذا فارغ)" },
      },
      required: [],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXECUTION
// ─────────────────────────────────────────────────────────────────────────────
async function executeTool(toolName: string, input: any, orgId: string): Promise<any> {
  try {
    switch (toolName) {

      // ── CREATE INVOICE ──────────────────────────────────────────────────────
      case "create_invoice": {
        let contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.contactName, mode: "insensitive" }, type: { in: ["CUSTOMER", "BOTH"] as any } },
        })
        if (!contact) {
          contact = await prisma.contact.create({
            data: { organizationId: orgId, name: input.contactName, type: "CUSTOMER" },
          })
        }

        const number  = await getNextDocNumber(orgId, "INVOICE")
        const today   = new Date()
        const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(today.getTime() + 30 * 86_400_000)

        let subtotal = 0
        const items = (input.items || []).map((item: any, idx: number) => {
          const total = round2(Number(item.quantity) * Number(item.unitPrice))
          subtotal = round2(subtotal + total)
          return { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxAmount: 0, total, sortOrder: idx }
        })

        const arAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } })

        await prisma.invoice.create({
          data: {
            organizationId: orgId, contactId: contact.id,
            number, type: "INVOICE", status: "DRAFT",
            date: today, dueDate,
            subtotal, taxAmount: 0, total: subtotal,
            amountDue: subtotal, amountPaid: 0,
            notes: input.notes || null,
            arAccountId: arAccount?.id,
            items: { create: items },
          },
        })

        return { success: true, number, total: subtotal, message: `✅ تم إنشاء الفاتورة **${number}** للعميل "${contact.name}" بمبلغ **${formatCurrency(subtotal)}** — الحالة: مسودة` }
      }

      // ── CREATE BILL ─────────────────────────────────────────────────────────
      case "create_bill": {
        let vendor = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.vendorName, mode: "insensitive" }, type: { in: ["VENDOR", "BOTH"] as any } },
        })
        if (!vendor) {
          vendor = await prisma.contact.create({
            data: { organizationId: orgId, name: input.vendorName, type: "VENDOR" },
          })
        }

        const number  = await getNextDocNumber(orgId, "BILL")
        const today   = new Date()
        const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(today.getTime() + 30 * 86_400_000)

        let subtotal = 0
        const items = (input.items || []).map((item: any, idx: number) => {
          const total = round2(Number(item.quantity) * Number(item.unitPrice))
          subtotal = round2(subtotal + total)
          return { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxAmount: 0, total, sortOrder: idx }
        })

        const apAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } })

        await prisma.bill.create({
          data: {
            organizationId: orgId, contactId: vendor.id,
            number, type: "BILL", status: "DRAFT",
            date: today, dueDate,
            subtotal, taxAmount: 0, total: subtotal,
            amountDue: subtotal, amountPaid: 0,
            notes: input.notes || null,
            apAccountId: apAccount?.id,
            items: { create: items },
          },
        })

        return { success: true, number, total: subtotal, message: `✅ تم إنشاء فاتورة المورد **${number}** من "${vendor.name}" بمبلغ **${formatCurrency(subtotal)}** — الحالة: مسودة` }
      }

      // ── RECORD PAYMENT ──────────────────────────────────────────────────────
      case "record_payment": {
        const contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.contactName, mode: "insensitive" } },
        })
        if (!contact) return { error: `لم يُوجد عميل/مورد باسم "${input.contactName}"` }

        const amount = round2(Number(input.amount))
        const method = input.method || "CASH"
        const isIncoming = input.type === "INCOMING"

        // Find the oldest unpaid invoice/bill to apply payment to
        let targetInvoiceId: string | null = null
        let targetBillId:    string | null = null

        if (isIncoming) {
          const inv = await prisma.invoice.findFirst({
            where: {
              organizationId: orgId,
              contactId: contact.id,
              status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
              ...(input.invoiceNumber ? { number: input.invoiceNumber } : {}),
            },
            orderBy: { dueDate: "asc" },
          })
          if (inv) {
            targetInvoiceId = inv.id
            const newPaid = round2(Number(inv.amountPaid) + amount)
            const newDue  = round2(Number(inv.total) - newPaid)
            await prisma.invoice.update({
              where: { id: inv.id },
              data: {
                amountPaid: newPaid,
                amountDue:  Math.max(0, newDue),
                status:     newDue <= 0 ? "PAID" : "PARTIAL",
              },
            })
          }
        } else {
          const bill = await prisma.bill.findFirst({
            where: {
              organizationId: orgId,
              contactId: contact.id,
              status: { in: ["OPEN", "PARTIAL", "OVERDUE"] },
              ...(input.invoiceNumber ? { number: input.invoiceNumber } : {}),
            },
            orderBy: { dueDate: "asc" },
          })
          if (bill) {
            targetBillId = bill.id
            const newPaid = round2(Number(bill.amountPaid) + amount)
            const newDue  = round2(Number(bill.total) - newPaid)
            await prisma.bill.update({
              where: { id: bill.id },
              data: {
                amountPaid: newPaid,
                amountDue:  Math.max(0, newDue),
                status:     newDue <= 0 ? "PAID" : "PARTIAL",
              },
            })
          }
        }

        // Find cash/bank account
        const cashAccount = await prisma.account.findFirst({
          where: { organizationId: orgId, accountType: method === "CASH" ? "CASH" : "BANK" },
        })
        const arAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } })
        const apAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } })

        // Create payment record
        await prisma.payment.create({
          data: {
            organizationId: orgId,
            contactId: contact.id,
            invoiceId: targetInvoiceId,
            billId:    targetBillId,
            type:      isIncoming ? "INCOMING" : "OUTGOING",
            date:      new Date(),
            amount,
            method:    method as any,
            notes:     input.notes || null,
            bankAccountId: null,
          },
        })

        // Journal entry: DR Cash / CR AR (incoming) or DR AP / CR Cash (outgoing)
        if (cashAccount && (isIncoming ? arAccount : apAccount)) {
          await createJournalEntry({
            organizationId: orgId,
            date:   new Date(),
            type:   "PAYMENT",
            description: `${isIncoming ? "تحصيل من" : "دفع لـ"} ${contact.name}`,
            lines: isIncoming
              ? [{ accountId: cashAccount.id, debit: amount, credit: 0 }, { accountId: arAccount!.id, debit: 0, credit: amount }]
              : [{ accountId: apAccount!.id, debit: amount, credit: 0 }, { accountId: cashAccount.id, debit: 0, credit: amount }],
          })
        }

        return {
          success: true,
          message: `✅ تم تسجيل ${isIncoming ? "تحصيل" : "دفعة"} **${formatCurrency(amount)}** ${isIncoming ? "من" : "لـ"} "${contact.name}" بـ${method === "CASH" ? "نقد" : "تحويل بنكي"}`,
        }
      }

      // ── CREATE JOURNAL ENTRY ────────────────────────────────────────────────
      case "create_journal_entry": {
        const date = input.date ? new Date(input.date) : new Date()

        // Resolve account names to IDs
        const resolvedLines: { accountId: string; debit: number; credit: number }[] = []
        for (const line of input.lines || []) {
          const account = await prisma.account.findFirst({
            where: { organizationId: orgId, name: { contains: line.accountName, mode: "insensitive" } },
          })
          if (!account) return { error: `لم يُوجد حساب باسم "${line.accountName}"` }
          resolvedLines.push({ accountId: account.id, debit: round2(Number(line.debit) || 0), credit: round2(Number(line.credit) || 0) })
        }

        const totalDebit  = round2(resolvedLines.reduce((s, l) => s + l.debit,  0))
        const totalCredit = round2(resolvedLines.reduce((s, l) => s + l.credit, 0))

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          return { error: `القيد غير متوازن — المدين: ${formatCurrency(totalDebit)} ≠ الدائن: ${formatCurrency(totalCredit)}` }
        }

        const journal = await createJournalEntry({
          organizationId: orgId,
          date,
          type:        "GENERAL",
          description: input.description,
          lines:       resolvedLines,
        })

        return { success: true, message: `✅ تم إنشاء القيد اليومي بمبلغ **${formatCurrency(totalDebit)}** — "${input.description}"` }
      }

      // ── CUSTOMER STATEMENT ──────────────────────────────────────────────────
      case "get_customer_statement": {
        const contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.contactName, mode: "insensitive" } },
        })
        if (!contact) return { error: `لم يُوجد "${input.contactName}"` }

        const isVendor = input.type === "VENDOR" || contact.type === "VENDOR"

        if (isVendor) {
          const bills = await prisma.bill.findMany({
            where: { organizationId: orgId, contactId: contact.id },
            orderBy: { date: "desc" }, take: 20,
          })
          const totalDue  = bills.filter((b) => ["OPEN", "PARTIAL", "OVERDUE"].includes(b.status)).reduce((s, b) => s + Number(b.amountDue), 0)
          const totalPaid = bills.filter((b) => b.status === "PAID").reduce((s, b) => s + Number(b.total), 0)
          return {
            contact: contact.name,
            totalDue: formatCurrency(totalDue),
            totalPaid: formatCurrency(totalPaid),
            openBills: bills.filter((b) => ["OPEN", "PARTIAL", "OVERDUE"].includes(b.status)).length,
            message: `كشف حساب المورد "${contact.name}":\n• إجمالي المستحق: ${formatCurrency(totalDue)}\n• إجمالي المدفوع: ${formatCurrency(totalPaid)}\n• فواتير مفتوحة: ${bills.filter((b) => ["OPEN", "PARTIAL", "OVERDUE"].includes(b.status)).length}\n${bills.slice(0, 5).map((b) => `  - ${b.number}: ${formatCurrency(Number(b.total))} — ${b.status}`).join("\n")}`,
          }
        } else {
          const invoices = await prisma.invoice.findMany({
            where: { organizationId: orgId, contactId: contact.id },
            orderBy: { date: "desc" }, take: 20,
          })
          const totalDue  = invoices.filter((i) => ["SENT", "PARTIAL", "OVERDUE"].includes(i.status)).reduce((s, i) => s + Number(i.amountDue), 0)
          const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.total), 0)
          const overdue   = invoices.filter((i) => i.status === "OVERDUE" || (["SENT", "PARTIAL"].includes(i.status) && i.dueDate < new Date()))
          return {
            contact:   contact.name,
            totalDue:  formatCurrency(totalDue),
            totalPaid: formatCurrency(totalPaid),
            overdueCount: overdue.length,
            message: `كشف حساب العميل "${contact.name}":\n• رصيد مستحق: **${formatCurrency(totalDue)}**\n• إجمالي محصل: ${formatCurrency(totalPaid)}\n${overdue.length > 0 ? `• ⚠️ متأخر: ${overdue.length} فاتورة بـ ${formatCurrency(overdue.reduce((s, i) => s + Number(i.amountDue), 0))}` : "• ✅ لا توجد فواتير متأخرة"}\n${invoices.slice(0, 5).map((i) => `  - ${i.number}: ${formatCurrency(Number(i.total))} — ${i.status}`).join("\n")}`,
          }
        }
      }

      // ── PROFIT ANALYSIS ─────────────────────────────────────────────────────
      case "get_profit_analysis": {
        const now   = new Date()
        const period = input.period || "month"
        const from  = period === "month"   ? new Date(now.getFullYear(), now.getMonth(), 1)
                    : period === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
                    : new Date(now.getFullYear(), 0, 1)

        const topN = Number(input.topN) || 10

        // Get invoice items with product info in the period
        const items = await prisma.invoiceItem.findMany({
          where: { invoice: { organizationId: orgId, date: { gte: from }, status: { in: ["SENT", "PARTIAL", "PAID"] } } },
          include: { product: true, invoice: true },
        })

        // Aggregate by product
        const productMap: Record<string, { name: string; revenue: number; cost: number; qty: number }> = {}
        for (const item of items) {
          const key  = item.product?.id || item.description
          const name = item.product?.name || item.description
          if (!productMap[key]) productMap[key] = { name, revenue: 0, cost: 0, qty: 0 }
          const qty     = Number(item.quantity)
          const revenue = Number(item.total)
          const cost    = item.product ? qty * Number(item.product.purchasePrice) : 0
          productMap[key].revenue += revenue
          productMap[key].cost    += cost
          productMap[key].qty     += qty
        }

        const sorted = Object.values(productMap)
          .map((p) => ({ ...p, profit: round2(p.revenue - p.cost), margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(1) : "0" }))
          .sort((a, b) => b.profit - a.profit)
          .slice(0, topN)

        const totalRev = sorted.reduce((s, p) => s + p.revenue, 0)
        const totalCost = sorted.reduce((s, p) => s + p.cost, 0)

        return {
          period,
          topProducts: sorted,
          message: `تحليل الربحية (${period === "month" ? "هذا الشهر" : period === "quarter" ? "هذا الربع" : "هذا العام"}):\n\n${sorted.map((p, i) => `${i + 1}. **${p.name}**: إيراد ${formatCurrency(p.revenue)} | ربح ${formatCurrency(p.profit)} | هامش ${p.margin}%`).join("\n")}\n\n📊 الإجمالي: إيراد ${formatCurrency(totalRev)} | ربح ${formatCurrency(totalRev - totalCost)} | هامش ${totalRev > 0 ? (((totalRev - totalCost) / totalRev) * 100).toFixed(1) : 0}%`,
        }
      }

      // ── CHECK STOCK ─────────────────────────────────────────────────────────
      case "check_stock": {
        const product = await prisma.product.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              { name:    { contains: input.productName, mode: "insensitive" } },
              { code:    { contains: input.productName, mode: "insensitive" } },
              { barcode: input.productName },
            ],
          },
          include: { stockLedger: true },
        })
        if (!product) return { error: `لم يُوجد منتج باسم "${input.productName}"` }

        const stock = product.stockLedger.reduce((s, l) => {
          if (l.type === "IN")         return s + Number(l.quantity)
          if (l.type === "OUT")        return s - Number(l.quantity)
          if (l.type === "ADJUSTMENT") return s + Number(l.quantity)
          return s
        }, 0)
        const isLow = stock <= Number(product.reorderLevel)

        return {
          productName:  product.name,
          stock,
          unit:         product.unit,
          salePrice:    Number(product.salePrice),
          purchasePrice: Number(product.purchasePrice),
          margin:       Number(product.salePrice) > 0 ? (((Number(product.salePrice) - Number(product.purchasePrice)) / Number(product.salePrice)) * 100).toFixed(1) + "%" : "—",
          reorderLevel: Number(product.reorderLevel),
          status:       isLow ? "⚠️ منخفض" : "✅ متوفر",
          message: `"${product.name}": **${stock} ${product.unit}** ${isLow ? "⚠️ منخفض!" : "✅"} | سعر بيع: ${formatCurrency(Number(product.salePrice))} | هامش: ${Number(product.salePrice) > 0 ? (((Number(product.salePrice) - Number(product.purchasePrice)) / Number(product.salePrice)) * 100).toFixed(1) : 0}%`,
        }
      }

      // ── SEARCH PRODUCTS ─────────────────────────────────────────────────────
      case "search_products": {
        const products = await prisma.product.findMany({
          where: {
            organizationId: orgId, isActive: true,
            OR: [
              { name:     { contains: input.query, mode: "insensitive" } },
              { code:     { contains: input.query, mode: "insensitive" } },
              { category: { contains: input.query, mode: "insensitive" } },
            ],
          },
          include: { stockLedger: true },
          take: 12,
        })
        if (!products.length) return { message: `لا توجد منتجات تطابق "${input.query}"` }

        return {
          products: products.map((p) => {
            const stock = p.stockLedger.reduce((s, l) => l.type === "IN" ? s + Number(l.quantity) : l.type === "OUT" ? s - Number(l.quantity) : s + Number(l.quantity), 0)
            const margin = Number(p.salePrice) > 0 ? (((Number(p.salePrice) - Number(p.purchasePrice)) / Number(p.salePrice)) * 100).toFixed(0) : "0"
            return `**${p.name}** (${p.code}) — بيع: ${formatCurrency(Number(p.salePrice))} | هامش: ${margin}% | مخزون: ${stock} ${p.unit}`
          }),
          count: products.length,
        }
      }

      // ── SEARCH CONTACTS ─────────────────────────────────────────────────────
      case "search_contacts": {
        const contacts = await prisma.contact.findMany({
          where: {
            organizationId: orgId, isActive: true,
            name: { contains: input.query, mode: "insensitive" },
            ...(input.type === "VENDOR"   ? { type: { in: ["VENDOR", "BOTH"] as any } }   :
                input.type === "CUSTOMER" ? { type: { in: ["CUSTOMER", "BOTH"] as any } } : {}),
          },
          select: { name: true, type: true, phone: true, email: true },
          take: 10,
        })
        if (!contacts.length) return { message: `لا توجد جهات اتصال تطابق "${input.query}"` }
        return { contacts: contacts.map((c) => `${c.name} (${c.type}) ${c.phone || ""}`) }
      }

      // ── CASH FLOW FORECAST ──────────────────────────────────────────────────
      case "get_cash_flow_forecast": {
        const now    = new Date()
        const in30   = new Date(now.getTime() + 30 * 86_400_000)

        const [cashAccounts, upcomingInvoices, upcomingBills] = await Promise.all([
          prisma.account.findMany({ where: { organizationId: orgId, accountType: { in: ["CASH", "BANK"] } }, include: { journalLines: { where: { journal: { status: "POSTED" } } } } }),
          prisma.invoice.findMany({ where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lte: in30 } }, include: { contact: true }, orderBy: { dueDate: "asc" } }),
          prisma.bill.findMany({ where: { organizationId: orgId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] }, dueDate: { lte: in30 } }, include: { contact: true }, orderBy: { dueDate: "asc" } }),
        ])

        const currentCash = cashAccounts.reduce((t, a) => t + a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0), 0)
        const expectedIn  = upcomingInvoices.reduce((s, i) => s + Number(i.amountDue), 0)
        const expectedOut = upcomingBills.reduce((s, b) => s + Number(b.amountDue), 0)
        const projected   = round2(currentCash + expectedIn - expectedOut)

        return {
          currentCash: formatCurrency(currentCash),
          expectedIn:  formatCurrency(expectedIn),
          expectedOut: formatCurrency(expectedOut),
          projected:   formatCurrency(projected),
          message: `توقعات التدفق النقدي — 30 يوم قادم:\n• الرصيد الحالي: **${formatCurrency(currentCash)}**\n• متوقع التحصيل: **+${formatCurrency(expectedIn)}** (${upcomingInvoices.length} فاتورة)\n• متوقع الدفع: **-${formatCurrency(expectedOut)}** (${upcomingBills.length} فاتورة)\n• الرصيد المتوقع: **${formatCurrency(projected)}** ${projected < 0 ? "🔴 عجز نقدي متوقع!" : projected < expectedOut * 0.5 ? "🟡 رصيد ضعيف — انتبه" : "🟢 وضع جيد"}\n\n${upcomingInvoices.slice(0, 3).map((i) => `📥 ${i.contact.name}: ${formatCurrency(Number(i.amountDue))} — ${i.dueDate.toLocaleDateString("ar-SA")}`).join("\n")}\n${upcomingBills.slice(0, 3).map((b) => `📤 ${b.contact.name}: ${formatCurrency(Number(b.amountDue))} — ${b.dueDate.toLocaleDateString("ar-SA")}`).join("\n")}`,
        }
      }

      // ── POS SUMMARY ─────────────────────────────────────────────────────────
      case "get_pos_summary": {
        const dateStr = input.date || new Date().toISOString().slice(0, 10)
        const from = new Date(dateStr + "T00:00:00.000Z")
        const to   = new Date(dateStr + "T23:59:59.999Z")

        const [txs, topItems] = await Promise.all([
          prisma.posTransaction.findMany({ where: { organizationId: orgId, date: { gte: from, lte: to }, status: "COMPLETED" } }),
          prisma.posTransactionItem.findMany({
            where: { transaction: { organizationId: orgId, date: { gte: from, lte: to }, status: "COMPLETED" } },
            include: { product: true },
          }),
        ])

        const total = txs.reduce((s, t) => s + Number(t.total), 0)
        const cash  = txs.filter((t) => t.paymentMethod === "CASH").reduce((s, t) => s + Number(t.total), 0)
        const card  = txs.filter((t) => t.paymentMethod === "CARD").reduce((s, t) => s + Number(t.total), 0)

        // Top selling products
        const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {}
        for (const item of topItems) {
          const name = item.product?.name || item.description
          if (!prodMap[name]) prodMap[name] = { name, qty: 0, revenue: 0 }
          prodMap[name].qty     += Number(item.quantity)
          prodMap[name].revenue += Number(item.total)
        }
        const topProds = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

        return {
          message: `مبيعات POS — ${dateStr}:\n• الإجمالي: **${formatCurrency(total)}** | ${txs.length} معاملة\n• نقد: ${formatCurrency(cash)} | بطاقة: ${formatCurrency(card)}\n• متوسط الفاتورة: ${formatCurrency(txs.length > 0 ? total / txs.length : 0)}\n\n🏆 أكثر المبيعات:\n${topProds.map((p, i) => `${i + 1}. ${p.name}: ${p.qty} وحدة — ${formatCurrency(p.revenue)}`).join("\n")}`,
        }
      }

      default:
        return { error: `أداة غير معروفة: ${toolName}` }
    }
  } catch (e: any) {
    return { error: `خطأ: ${e.message}` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AI AGENT — AGENTIC LOOP
// ─────────────────────────────────────────────────────────────────────────────
export async function runAIAgent(
  message: string,
  organizationId: string,
  orgName: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  countryCode = "SA",
) {
  const { getCountry } = await import("./countries")
  const country = getCountry(countryCode)
  const context = await getFinancialContext(organizationId)

  const vatNote = country.vatEnabled
    ? `ضريبة القيمة المضافة ${country.vatRate}% (${country.vatName}) — احسبها عند الطلب`
    : `لا ضريبة قيمة مضافة في ${country.nameAr}`

  const systemPrompt = `أنت **محاسب قانوني خبير ومستشار مالي** لشركة "${orgName}". دورك مزدوج:
1. تُنفّذ المهام المحاسبية مباشرةً (فواتير، دفعات، قيود)
2. تُقدم تحليلاً مالياً ذكياً واستباقياً — لا تنتظر أن يسألك، انتبه للمشاكل وأشر إليها

معلومات الشركة:
- الدولة: ${country.flag} ${country.nameAr} | العملة: ${country.currencyAr} (${country.currencySymbol})
- ${vatNote}
- التاريخ اليوم: ${new Date().toLocaleDateString("ar-SA")}

البيانات المالية الحالية:
${context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
قواعد السلوك:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**التنفيذ الفوري:**
- إذا طُلب إنشاء فاتورة/بيع/شراء → استخدم الأداة مباشرة، لا تسأل عن تأكيد إضافي
- إذا طُلب تسجيل دفعة → نفّذها فوراً
- إذا طُلب قيد يومية → نفّذه بعد التحقق من التوازن
- بعد كل تنفيذ: أذكر الرقم المرجعي والمبلغ ورابط المراجعة

**التحليل الذكي:**
- عند أي سؤال مالي عام → ابدأ بالأهم أولاً (المشكلة الأكبر تأثيراً)
- استخدم النسب المئوية والمقارنات بدل الأرقام المجردة
- إذا رأيت خطراً في البيانات (تراجع مبيعات، مخزون منخفض، رصيد ضعيف) → نبّه فوراً حتى لو لم يُسأل
- قدّم توصيات عملية قابلة للتنفيذ (مو فقط ملاحظات)

**التواصل:**
- أجب بنفس لهجة المستخدم (عربي فصيح/عامي/عراقي/خليجي)
- اعرض المبالغ دائماً بعملة الشركة (${country.currencySymbol})
- استخدم **bold** للأرقام المهمة
- إذا البيانات تدل على مشكلة، قل ذلك بوضوح — لا تلطّف الكلام

**حدودك:**
- لا تخترع أرقاماً — استخدم البيانات الحقيقية فقط
- إذا سُئلت عن شيء لا تملك بياناته → قل ذلك واقترح الأداة المناسبة
- القيود اليومية لازم تكون متوازنة (مدين = دائن) وإلا ارفضها

**نمط الإجابة للتحليل:**
1. الوضع الحالي (رقم واضح)
2. المقارنة (بالشهر/الأسبوع الماضي)
3. التشخيص (ليش؟)
4. التوصية (وش تسوي؟)`

  type MsgParam = Anthropic.MessageParam
  let messages: MsgParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as MsgParam)),
    { role: "user", content: message },
  ]

  let iterations = 0
  while (iterations < 8) {
    iterations++

    const response = await anthropic.messages.create({
      model:      "claude-opus-4-8",
      max_tokens: 4096,
      system:     systemPrompt,
      messages,
      tools:      AGENT_TOOLS,
    })

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text")
      return textBlock?.type === "text" ? textBlock.text : "عذراً، حدث خطأ في المعالجة."
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input, organizationId)
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
        }
      }

      messages.push({ role: "user", content: toolResults })
      continue
    }

    break
  }

  return "عذراً، لم أتمكن من إكمال الطلب. حاول مرة أخرى."
}
