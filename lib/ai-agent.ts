import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCurrency } from "./utils"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "./org"
import { createJournalEntry, round2 } from "./accounting"
import { getInventoryAccounts, recordCogsForSale } from "./inventory"
import { checkCreditLimit } from "./credit"

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
        dueDate:         { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD (اختياري، افتراضي 30 يوم)" },
        salespersonName: { type: "string", description: "اسم المندوب (اختياري — تُحسب عمولته تلقائياً)" },
        notes:           { type: "string" },
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
  {
    name: "get_due_cheques",
    description: "يجلب الشيكات المستحقة قريباً (واردة وصادرة) خلال عدد أيام معيّن. مهم لمتابعة السيولة.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "عدد الأيام القادمة (افتراضي ٧)" },
        type: { type: "string", enum: ["INCOMING", "OUTGOING"], description: "نوع الشيك (اختياري)" },
      },
      required: [],
    },
  },
  {
    name: "record_cheque",
    description: "يسجل شيكاً جديداً (وارد من عميل أو صادر لمورد) مع القيد المحاسبي.",
    input_schema: {
      type: "object" as const,
      properties: {
        type:         { type: "string", enum: ["INCOMING", "OUTGOING"], description: "وارد أو صادر" },
        chequeNumber: { type: "string" },
        partyName:    { type: "string", description: "اسم الساحب (وارد) أو المستفيد (صادر)" },
        amount:       { type: "number" },
        bankName:     { type: "string" },
        dueDate:      { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD" },
      },
      required: ["type", "chequeNumber", "partyName", "amount", "dueDate"],
    },
  },
  {
    name: "get_vat_summary",
    description: "يحسب صافي ضريبة القيمة المضافة المستحقة لفترة: ضريبة المخرجات (المبيعات) ناقص ضريبة المدخلات (المشتريات). للسؤال 'كم ضريبة أطلع؟'",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["month", "quarter", "year"], description: "الفترة (افتراضي الشهر)" },
      },
      required: [],
    },
  },
  {
    name: "get_account_balance",
    description: "يجلب رصيد حساب معيّن بالاسم (مثل: البنك، الصندوق، العملاء). للسؤال 'شنو رصيد البنك؟'",
    input_schema: {
      type: "object" as const,
      properties: {
        accountName: { type: "string", description: "اسم الحساب أو جزء منه" },
      },
      required: ["accountName"],
    },
  },
  {
    name: "get_financial_statements",
    description: "يجلب ملخص قائمة الدخل (الأرباح والخسائر) والميزانية العمومية. للأسئلة 'وين أرباحي؟' أو 'شنو ميزانيتي؟'",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["month", "quarter", "year"], description: "فترة قائمة الدخل (افتراضي السنة)" },
      },
      required: [],
    },
  },
  {
    name: "record_expense",
    description: "يسجل مصروفاً نقدياً أو بنكياً مباشرة (مثل كهرباء، إيجار، رواتب) مع القيد المحاسبي. يبحث عن حساب المصروف المناسب بالاسم.",
    input_schema: {
      type: "object" as const,
      properties: {
        expenseName: { type: "string", description: "نوع المصروف (كهرباء، إيجار، اتصالات، تسويق...)" },
        amount:      { type: "number" },
        paidFrom:    { type: "string", enum: ["CASH", "BANK"], description: "نقد أو بنك (افتراضي نقد)" },
        description: { type: "string", description: "وصف اختياري" },
      },
      required: ["expenseName", "amount"],
    },
  },
  {
    name: "review_books",
    description: "مراجعة شاملة لصحة الحسابات (مثل ما يسوي المحاسب آخر الشهر): فواتير متأخرة، شيكات مستحقة، مخزون سالب، مستندات مسودة، سيولة منخفضة. للسؤال 'هل في أخطاء بحساباتي؟'",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "query_commissions",
    description: "يعرض عمولات المندوبين: المعلّقة أو المدفوعة لمندوب معيّن أو لجميع المندوبين. للسؤال 'كم عمولة أحمد؟' أو 'شنو العمولات المستحقة؟'",
    input_schema: {
      type: "object" as const,
      properties: {
        employeeName: { type: "string", description: "اسم المندوب (اختياري — كل المندوبين إذا فارغ)" },
        status:       { type: "string", enum: ["PENDING", "PAID", "ALL"], description: "حالة العمولة (افتراضي ALL)" },
      },
      required: [],
    },
  },
  {
    name: "list_employees",
    description: "يعرض قائمة الموظفين مع رواتبهم ونسب عمولاتهم. للسؤال 'من هم الموظفين؟' أو 'من عنده عمولة؟'",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "فلتر بالاسم أو القسم (اختياري)" },
      },
      required: [],
    },
  },
  {
    name: "get_payroll_summary",
    description: "يعرض ملخص الرواتب: إجمالي الرواتب الشهرية، عدد الموظفين، توزيع حسب القسم. للسؤال 'كم رواتبنا الشهر؟'",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_invoices",
    description: "يبحث عن فواتير بيع بفلاتر: العميل، الحالة، الفترة الزمنية. للسؤال 'شنو فواتير العميل X' أو 'الفواتير غير المدفوعة'",
    input_schema: {
      type: "object" as const,
      properties: {
        customerName: { type: "string", description: "اسم العميل (اختياري)" },
        status:       { type: "string", enum: ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE"], description: "حالة الفاتورة (اختياري)" },
        period:       { type: "string", enum: ["week", "month", "quarter", "year"], description: "الفترة (اختياري)" },
      },
      required: [],
    },
  },
  {
    name: "create_credit_note",
    description: "ينشئ إشعار خصم (مرتجع مبيعات) لفاتورة سابقة. استخدم عند إلغاء فاتورة أو إرجاع بضاعة من عميل.",
    input_schema: {
      type: "object" as const,
      properties: {
        customerName:  { type: "string", description: "اسم العميل" },
        invoiceNumber: { type: "string", description: "رقم الفاتورة الأصلية (اختياري)" },
        amount:        { type: "number", description: "مبلغ الإشعار (يجب أن يكون موجباً)" },
        reason:        { type: "string", description: "سبب الإشعار" },
      },
      required: ["customerName", "amount", "reason"],
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
        // 1. Resolve or create customer contact
        let contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.contactName, mode: "insensitive" }, type: { in: ["CUSTOMER", "BOTH"] as any } },
        })
        if (!contact) {
          contact = await prisma.contact.create({
            data: { organizationId: orgId, name: input.contactName, type: "CUSTOMER" },
          })
        }

        // 2. Resolve salesperson (optional)
        let salespersonId: string | null = null
        if (input.salespersonName) {
          const emp = await prisma.employee.findFirst({
            where: { organizationId: orgId, name: { contains: input.salespersonName, mode: "insensitive" }, isActive: true },
          })
          if (emp) salespersonId = emp.id
        }

        const number  = await getNextDocNumber(orgId, "INVOICE")
        const today   = new Date()
        const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(today.getTime() + 30 * 86_400_000)

        // 3. Build line items — auto-resolve product by description for COGS/stock
        let subtotal = 0
        const lineItems: Array<{ description: string; productId: string | null; quantity: number; unitPrice: number; taxAmount: number; total: number }> = []
        for (const item of (input.items || [])) {
          const product = await prisma.product.findFirst({
            where: {
              organizationId: orgId, isActive: true,
              OR: [
                { name: { contains: item.description, mode: "insensitive" } },
                { code: { contains: item.description, mode: "insensitive" } },
              ],
            },
          })
          const lineTotal = round2(Number(item.quantity) * Number(item.unitPrice))
          subtotal = round2(subtotal + lineTotal)
          lineItems.push({ description: item.description, productId: product?.id || null, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxAmount: 0, total: lineTotal })
        }
        const total = subtotal

        // 4. Credit limit soft-check (warn but always proceed — no UI override in agent)
        let creditWarning = ""
        const credit = await checkCreditLimit(orgId, contact.id, total)
        if (credit.exceeded) {
          creditWarning = `\n⚠️ **تحذير ائتماني**: العميل تجاوز حد الائتمان — الحد: ${formatCurrency(credit.limit)}، المستحق: ${formatCurrency(credit.outstanding)}`
        }

        // 5. Find GL accounts
        const arAccount      = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } })
        const revenueAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "REVENUE" } })

        // 6. Create invoice record
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: orgId, contactId: contact.id,
            number, type: "INVOICE", status: "DRAFT",
            date: today, dueDate,
            subtotal, taxAmount: 0, total,
            amountDue: total, amountPaid: 0,
            notes: input.notes || null,
            arAccountId: arAccount?.id,
            salespersonId,
            items: { create: lineItems },
          },
        })

        // 7. Post AR + Revenue journal → promote to SENT
        if (arAccount && revenueAccount) {
          await createJournalEntry({
            organizationId: orgId, date: today, type: "SALES",
            description: `فاتورة مبيعات ${number}`,
            sourceType: "invoice", sourceId: invoice.id,
            lines: [
              { accountId: arAccount.id,      debit: total, credit: 0,     description: `فاتورة ${number}` },
              { accountId: revenueAccount.id, debit: 0,     credit: total, description: `إيرادات ${number}` },
            ],
          })
          await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT" } })

          // 8. Perpetual COGS: DR COGS / CR Inventory for inventoried products
          const warehouse = await getOrCreateDefaultWarehouse(orgId)
          const cogsTotal = await recordCogsForSale({
            organizationId: orgId, warehouseId: warehouse.id,
            date: today, reference: number,
            items: lineItems.map((l) => ({ productId: l.productId, quantity: l.quantity })),
            createStockOut: true,
          })
          if (cogsTotal > 0) {
            const { inventory, cogs } = await getInventoryAccounts(orgId)
            if (inventory && cogs) {
              await createJournalEntry({
                organizationId: orgId, date: today, type: "SALES",
                description: `تكلفة بضاعة مباعة — فاتورة ${number}`,
                sourceType: "invoice-cogs", sourceId: invoice.id,
                lines: [
                  { accountId: cogs.id,      debit: cogsTotal, credit: 0 },
                  { accountId: inventory.id, debit: 0,         credit: cogsTotal },
                ],
              })
            }
          }
        }

        // 9. Auto-record sales commission
        if (salespersonId) {
          const emp = await prisma.employee.findFirst({
            where: { id: salespersonId, organizationId: orgId },
            select: { commissionRate: true },
          })
          if (emp?.commissionRate && Number(emp.commissionRate) > 0) {
            const rate = Number(emp.commissionRate)
            const commAmount = Math.round(total * (rate / 100) * 100) / 100
            await prisma.salesCommission.create({
              data: { organizationId: orgId, invoiceId: invoice.id, employeeId: salespersonId, invoiceTotal: total, rate, amount: commAmount },
            })
          }
        }

        const hasInventory = lineItems.some((l) => l.productId)
        return {
          success: true, number, total,
          message: `✅ تم إنشاء الفاتورة **${number}** للعميل "${contact.name}" بمبلغ **${formatCurrency(total)}** — تم الترحيل المحاسبي (ذمم مدينة + إيرادات${hasInventory ? " + تكلفة البضاعة المباعة" : ""})${creditWarning}`,
        }
      }

      // ── CREATE BILL ─────────────────────────────────────────────────────────
      case "create_bill": {
        // 1. Resolve or create vendor contact
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

        // 2. Build line items — auto-resolve products for inventory routing
        let subtotal = 0
        const lineItems: Array<{ description: string; productId: string | null; quantity: number; unitPrice: number; taxAmount: number; total: number }> = []
        for (const item of (input.items || [])) {
          const product = await prisma.product.findFirst({
            where: {
              organizationId: orgId, isActive: true,
              OR: [
                { name: { contains: item.description, mode: "insensitive" } },
                { code: { contains: item.description, mode: "insensitive" } },
              ],
            },
          })
          const lineTotal = round2(Number(item.quantity) * Number(item.unitPrice))
          subtotal = round2(subtotal + lineTotal)
          lineItems.push({ description: item.description, productId: product?.id || null, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxAmount: 0, total: lineTotal })
        }
        const total = subtotal

        // 3. Split inventoried vs expense amounts
        const productIds = lineItems.map((l) => l.productId).filter(Boolean) as string[]
        const inventoriedProducts = productIds.length
          ? await prisma.product.findMany({ where: { id: { in: productIds }, organizationId: orgId, isInventoried: true }, select: { id: true } })
          : []
        const inventoriedIds = new Set(inventoriedProducts.map((p) => p.id))

        let inventoryAmount = 0
        let expenseAmount = 0
        for (const l of lineItems) {
          const lineNet = round2(l.quantity * l.unitPrice)
          if (l.productId && inventoriedIds.has(l.productId)) inventoryAmount = round2(inventoryAmount + lineNet)
          else expenseAmount = round2(expenseAmount + lineNet)
        }

        // 4. Find GL accounts
        const apAccount       = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_PAYABLE" } })
        const expenseAccount  = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" } })
        const { inventory: inventoryAccount } = await getInventoryAccounts(orgId)

        // 5. Create bill record
        const bill = await prisma.bill.create({
          data: {
            organizationId: orgId, contactId: vendor.id,
            number, type: "BILL", status: "DRAFT",
            date: today, dueDate,
            subtotal, taxAmount: 0, total,
            amountDue: total, amountPaid: 0,
            notes: input.notes || null,
            apAccountId: apAccount?.id,
            items: { create: lineItems },
          },
        })

        // 6. Post AP + Inventory/Expense journal → promote to OPEN
        if (apAccount && (inventoryAccount || expenseAccount)) {
          const fallbackExpense = expenseAccount!
          const journalLines: Array<{ accountId: string; debit: number; credit: number; description: string }> = [
            { accountId: apAccount.id, debit: 0, credit: total, description: `مستحق للمورد ${number}` },
          ]
          const invTarget = inventoryAccount ?? fallbackExpense
          if (inventoryAmount > 0) journalLines.push({ accountId: invTarget.id, debit: inventoryAmount, credit: 0, description: `مخزون مشتريات ${number}` })
          if (expenseAmount  > 0) journalLines.push({ accountId: fallbackExpense.id, debit: expenseAmount,  credit: 0, description: `مصروف فاتورة ${number}` })

          await createJournalEntry({
            organizationId: orgId, date: today, type: "PURCHASE",
            description: `فاتورة مورد ${number}`,
            sourceType: "bill", sourceId: bill.id,
            lines: journalLines,
          })
          await prisma.bill.update({ where: { id: bill.id }, data: { status: "OPEN" } })
        }

        // 7. Perpetual stock: StockLedger IN for each inventoried line
        if (inventoriedIds.size > 0) {
          const warehouse = await getOrCreateDefaultWarehouse(orgId)
          for (const l of lineItems) {
            if (!l.productId || !inventoriedIds.has(l.productId) || l.quantity <= 0) continue
            await prisma.stockLedger.create({
              data: {
                productId: l.productId,
                warehouseId: warehouse.id,
                date: today,
                reference: number,
                quantity: l.quantity,
                unitCost: l.unitPrice,
                type: "IN",
                billId: bill.id,
              },
            })
          }
        }

        const hasInventory = inventoryAmount > 0
        return {
          success: true, number, total,
          message: `✅ تم إنشاء فاتورة المورد **${number}** من "${vendor.name}" بمبلغ **${formatCurrency(total)}** — تم الترحيل المحاسبي (ذمم دائنة + ${hasInventory ? `مخزون ${inventoriedIds.size > 0 ? "(تم تحديث الكميات)" : ""}` : "مصروفات"})`,
        }
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

      // ── DUE CHEQUES ─────────────────────────────────────────────────────────
      case "get_due_cheques": {
        const days = Number(input.days) || 7
        const until = new Date(Date.now() + days * 86_400_000)
        const cheques = await prisma.cheque.findMany({
          where: {
            organizationId: orgId,
            status: { in: ["PENDING", "DEPOSITED"] },
            dueDate: { lte: until },
            ...(input.type ? { type: input.type } : {}),
          },
          orderBy: { dueDate: "asc" },
          take: 20,
        })
        if (!cheques.length) return { message: `لا توجد شيكات مستحقة خلال ${days} يوم` }

        const incoming = cheques.filter((c) => c.type === "INCOMING")
        const outgoing = cheques.filter((c) => c.type === "OUTGOING")
        const inTotal  = incoming.reduce((s, c) => s + Number(c.amount), 0)
        const outTotal = outgoing.reduce((s, c) => s + Number(c.amount), 0)

        return {
          message: `الشيكات المستحقة خلال ${days} يوم:\n\n📥 واردة (${incoming.length}): **${formatCurrency(inTotal)}**\n${incoming.slice(0, 5).map((c) => `  • ${c.chequeNumber} — ${c.partyName}: ${formatCurrency(Number(c.amount))} (${c.dueDate.toLocaleDateString("ar-AE")})`).join("\n")}\n\n📤 صادرة (${outgoing.length}): **${formatCurrency(outTotal)}**\n${outgoing.slice(0, 5).map((c) => `  • ${c.chequeNumber} — ${c.partyName}: ${formatCurrency(Number(c.amount))} (${c.dueDate.toLocaleDateString("ar-AE")})`).join("\n")}\n\n💰 صافي التدفق المتوقع: **${formatCurrency(inTotal - outTotal)}**`,
        }
      }

      // ── RECORD CHEQUE ───────────────────────────────────────────────────────
      case "record_cheque": {
        const isIncoming = input.type === "INCOMING"
        const amount = round2(Number(input.amount))
        const { getChequeAccount, getControlAccount } = await import("./cheques")

        const chequeAccount  = await getChequeAccount(orgId, input.type)
        const controlAccount = await getControlAccount(orgId, isIncoming ? "AR" : "AP")

        let recordJournalId: string | null = null
        if (chequeAccount && controlAccount) {
          const journal = await createJournalEntry({
            organizationId: orgId,
            date: new Date(),
            type: isIncoming ? "RECEIPT" : "PAYMENT",
            description: isIncoming
              ? `استلام شيك ${input.chequeNumber} من ${input.partyName}`
              : `إصدار شيك ${input.chequeNumber} لـ ${input.partyName}`,
            lines: isIncoming
              ? [{ accountId: chequeAccount.id, debit: amount, credit: 0 }, { accountId: controlAccount.id, debit: 0, credit: amount }]
              : [{ accountId: controlAccount.id, debit: amount, credit: 0 }, { accountId: chequeAccount.id, debit: 0, credit: amount }],
          })
          recordJournalId = journal.id
        }

        await prisma.cheque.create({
          data: {
            organizationId: orgId,
            type: input.type,
            chequeNumber: input.chequeNumber,
            bankName: input.bankName || null,
            partyName: input.partyName,
            amount,
            currency: "AED",
            issueDate: new Date(),
            dueDate: new Date(input.dueDate),
            status: "PENDING",
            recordJournalId,
          },
        })

        return { success: true, message: `✅ تم تسجيل شيك ${isIncoming ? "وارد" : "صادر"} **${input.chequeNumber}** ${isIncoming ? "من" : "لـ"} "${input.partyName}" بمبلغ **${formatCurrency(amount)}** — يستحق ${new Date(input.dueDate).toLocaleDateString("ar-AE")}` }
      }

      // ── VAT SUMMARY ─────────────────────────────────────────────────────────
      case "get_vat_summary": {
        const now = new Date()
        const period = input.period || "month"
        const from = period === "month"   ? new Date(now.getFullYear(), now.getMonth(), 1)
                   : period === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
                   : new Date(now.getFullYear(), 0, 1)

        const [sales, purchases] = await Promise.all([
          prisma.invoice.aggregate({ where: { organizationId: orgId, date: { gte: from }, status: { in: ["SENT", "PARTIAL", "PAID", "OVERDUE"] } }, _sum: { taxAmount: true, subtotal: true } }),
          prisma.bill.aggregate({ where: { organizationId: orgId, date: { gte: from }, status: { in: ["OPEN", "PARTIAL", "PAID", "OVERDUE"] } }, _sum: { taxAmount: true, subtotal: true } }),
        ])

        const outputTax = round2(Number(sales._sum.taxAmount || 0))      // ضريبة المخرجات
        const inputTax  = round2(Number(purchases._sum.taxAmount || 0))  // ضريبة المدخلات
        const netVat    = round2(outputTax - inputTax)
        const label = period === "month" ? "هذا الشهر" : period === "quarter" ? "هذا الربع" : "هذا العام"

        return {
          message: `ملخص ضريبة القيمة المضافة (${label}):\n• ضريبة المخرجات (على المبيعات): **${formatCurrency(outputTax)}**\n• ضريبة المدخلات (على المشتريات): **${formatCurrency(inputTax)}**\n• ${netVat >= 0 ? `الضريبة المستحقة للدفع: **${formatCurrency(netVat)}**` : `رصيد ضريبي لصالحك: **${formatCurrency(-netVat)}**`}`,
        }
      }

      // ── ACCOUNT BALANCE ─────────────────────────────────────────────────────
      case "get_account_balance": {
        const account = await prisma.account.findFirst({
          where: { organizationId: orgId, name: { contains: input.accountName, mode: "insensitive" } },
          include: { journalLines: { where: { journal: { status: "POSTED" } } } },
        })
        if (!account) return { error: `لم يُوجد حساب باسم "${input.accountName}"` }

        const debit  = account.journalLines.reduce((s, l) => s + Number(l.debit), 0)
        const credit = account.journalLines.reduce((s, l) => s + Number(l.credit), 0)
        const opening = Number(account.openingBalance)
        const balance = account.nature === "DEBIT" ? round2(opening + debit - credit) : round2(opening + credit - debit)

        return { message: `رصيد حساب "${account.name}": **${formatCurrency(balance)}**` }
      }

      // ── FINANCIAL STATEMENTS ────────────────────────────────────────────────
      case "get_financial_statements": {
        const now = new Date()
        const period = input.period || "year"
        const from = period === "month"   ? new Date(now.getFullYear(), now.getMonth(), 1)
                   : period === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
                   : new Date(now.getFullYear(), 0, 1)

        const { getProfitAndLoss, getBalanceSheet } = await import("./accounting")
        const [pl, bs] = await Promise.all([
          getProfitAndLoss(orgId, from, now),
          getBalanceSheet(orgId, now),
        ])

        return {
          message: `📄 قائمة الدخل (${period === "month" ? "الشهر" : period === "quarter" ? "الربع" : "السنة"}):\n• الإيرادات: **${formatCurrency(pl.totalRevenue)}**\n• المصروفات: **${formatCurrency(pl.totalExpenses)}**\n• صافي ${pl.netProfit >= 0 ? "الربح" : "الخسارة"}: **${formatCurrency(Math.abs(pl.netProfit))}**\n\n📊 الميزانية العمومية:\n• الأصول: **${formatCurrency(bs.totalAssets)}**\n• الخصوم: **${formatCurrency(bs.totalLiabilities)}**\n• حقوق الملكية: **${formatCurrency(bs.totalEquity)}**\n• التوازن: ${Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 1 ? "✅ متوازنة" : "⚠️ غير متوازنة — راجع القيود"}`,
        }
      }

      // ── RECORD EXPENSE ──────────────────────────────────────────────────────
      case "record_expense": {
        const amount = round2(Number(input.amount))
        const paidFrom = input.paidFrom === "BANK" ? "BANK" : "CASH"

        // Find expense account by name, fallback to generic "مصروفات أخرى"
        let expenseAccount = await prisma.account.findFirst({
          where: { organizationId: orgId, accountType: "EXPENSE", name: { contains: input.expenseName, mode: "insensitive" } },
        })
        if (!expenseAccount) {
          expenseAccount = await prisma.account.findFirst({
            where: { organizationId: orgId, accountType: "EXPENSE", name: { contains: "أخرى" } },
          }) ?? await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "EXPENSE" }, orderBy: { code: "desc" } })
        }
        const cashAccount = await prisma.account.findFirst({
          where: { organizationId: orgId, accountType: paidFrom === "BANK" ? "BANK" : "CASH" },
        })
        if (!expenseAccount || !cashAccount) return { error: "لم أجد حساب المصروف أو النقدية" }

        await createJournalEntry({
          organizationId: orgId,
          date: new Date(),
          type: "PAYMENT",
          description: input.description || `مصروف ${input.expenseName}`,
          lines: [
            { accountId: expenseAccount.id, debit: amount, credit: 0 },
            { accountId: cashAccount.id,    debit: 0,      credit: amount },
          ],
        })

        return { success: true, message: `✅ تم تسجيل مصروف **${expenseAccount.name}** بمبلغ **${formatCurrency(amount)}** (${paidFrom === "BANK" ? "من البنك" : "نقداً"})` }
      }

      // ── REVIEW BOOKS (month-end health check) ───────────────────────────────
      case "review_books": {
        const now = new Date()
        const soon = new Date(now.getTime() + 7 * 86_400_000)

        const [overdueInv, overdueBills, dueCheques, draftInv, draftBills, lowProducts, cashAccounts] = await Promise.all([
          prisma.invoice.findMany({ where: { organizationId: orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } }, include: { contact: true } }),
          prisma.bill.findMany({ where: { organizationId: orgId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } }, include: { contact: true } }),
          prisma.cheque.findMany({ where: { organizationId: orgId, status: { in: ["PENDING", "DEPOSITED"] }, dueDate: { lte: soon } } }),
          prisma.invoice.count({ where: { organizationId: orgId, status: "DRAFT" } }),
          prisma.bill.count({ where: { organizationId: orgId, status: "DRAFT" } }),
          prisma.product.findMany({ where: { organizationId: orgId, isActive: true, isInventoried: true }, include: { stockLedger: true } }),
          prisma.account.findMany({ where: { organizationId: orgId, accountType: { in: ["CASH", "BANK"] } }, include: { journalLines: { where: { journal: { status: "POSTED" } } } } }),
        ])

        const negStock = lowProducts.filter((p) => {
          const s = p.stockLedger.reduce((sum, l) => l.type === "IN" ? sum + Number(l.quantity) : l.type === "OUT" ? sum - Number(l.quantity) : sum + Number(l.quantity), 0)
          return s < 0
        })
        const cashBalance = cashAccounts.reduce((t, a) => t + a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0), 0)
        const overdueInvTotal = overdueInv.reduce((s, i) => s + Number(i.amountDue), 0)
        const overdueBillTotal = overdueBills.reduce((s, b) => s + Number(b.amountDue), 0)

        const issues: string[] = []
        if (overdueInv.length)  issues.push(`🔴 ${overdueInv.length} فاتورة عميل متأخرة بمجموع ${formatCurrency(overdueInvTotal)} — تحتاج تحصيل`)
        if (overdueBills.length) issues.push(`🟠 ${overdueBills.length} فاتورة مورد متأخرة بمجموع ${formatCurrency(overdueBillTotal)} — تحتاج دفع`)
        if (dueCheques.length)  issues.push(`🟡 ${dueCheques.length} شيك يستحق خلال ٧ أيام`)
        if (negStock.length)    issues.push(`🔴 ${negStock.length} منتج برصيد مخزون سالب — خطأ في الكميات: ${negStock.slice(0, 3).map((p) => p.name).join(", ")}`)
        if (draftInv > 0)       issues.push(`🟡 ${draftInv} فاتورة مبيعات مسودة لم تُرحّل`)
        if (draftBills > 0)     issues.push(`🟡 ${draftBills} فاتورة مورد مسودة لم تُرحّل`)
        if (cashBalance < 0)    issues.push(`🔴 رصيد النقدية سالب (${formatCurrency(cashBalance)}) — خطأ محاسبي`)

        if (issues.length === 0) {
          return { message: "✅ راجعت الحسابات — كل شيء سليم: لا فواتير متأخرة، لا مخزون سالب، لا مسودات معلّقة، السيولة موجبة." }
        }
        return { message: `🔍 مراجعة الحسابات — وجدت ${issues.length} نقطة تحتاج انتباه:\n\n${issues.join("\n")}` }
      }

      // ── QUERY COMMISSIONS ───────────────────────────────────────────────────
      case "query_commissions": {
        const status = input.status === "PENDING" ? "PENDING" : input.status === "PAID" ? "PAID" : undefined

        let employeeId: string | undefined
        if (input.employeeName) {
          const emp = await prisma.employee.findFirst({
            where: { organizationId: orgId, name: { contains: input.employeeName, mode: "insensitive" } },
          })
          if (!emp) return { error: `لم يُوجد موظف باسم "${input.employeeName}"` }
          employeeId = emp.id
        }

        const where: Record<string, unknown> = { organizationId: orgId }
        if (employeeId) where.employeeId = employeeId
        if (status)     where.status     = status

        const commissions = await prisma.salesCommission.findMany({
          where: where as any,
          include: {
            employee: { select: { name: true } },
            invoice:  { select: { number: true, date: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })

        if (!commissions.length) return { message: `لا توجد عمولات${input.employeeName ? ` للمندوب "${input.employeeName}"` : ""}${status ? ` بحالة ${status === "PENDING" ? "معلّقة" : "مدفوعة"}` : ""}` }

        const pending = commissions.filter((c) => c.status === "PENDING")
        const paid    = commissions.filter((c) => c.status === "PAID")
        const totalPending = pending.reduce((s, c) => s + Number(c.amount), 0)
        const totalPaid    = paid.reduce((s, c) => s + Number(c.amount), 0)

        // Group by employee
        const byEmp: Record<string, { name: string; pending: number; paid: number }> = {}
        for (const c of commissions) {
          const name = c.employee.name
          if (!byEmp[name]) byEmp[name] = { name, pending: 0, paid: 0 }
          if (c.status === "PENDING") byEmp[name].pending += Number(c.amount)
          else byEmp[name].paid += Number(c.amount)
        }

        return {
          message: `عمولات المندوبين${input.employeeName ? ` — ${input.employeeName}` : ""}:\n• معلّقة (مستحقة): **${formatCurrency(totalPending)}** (${pending.length} عمولة)\n• مدفوعة: **${formatCurrency(totalPaid)}** (${paid.length} عمولة)\n\nتفصيل حسب المندوب:\n${Object.values(byEmp).map((e) => `• ${e.name}: معلّق ${formatCurrency(e.pending)} | مدفوع ${formatCurrency(e.paid)}`).join("\n")}`,
        }
      }

      // ── LIST EMPLOYEES ──────────────────────────────────────────────────────
      case "list_employees": {
        const employees = await prisma.employee.findMany({
          where: {
            organizationId: orgId, isActive: true,
            ...(input.query ? { OR: [{ name: { contains: input.query, mode: "insensitive" } }, { department: { contains: input.query, mode: "insensitive" } }] } : {}),
          },
          orderBy: { name: "asc" },
        })

        if (!employees.length) return { message: "لا يوجد موظفون نشطون" }

        return {
          count: employees.length,
          message: `الموظفون النشطون (${employees.length}):\n${employees.map((e) => `• **${e.name}** (${e.employeeId}) — ${e.position || "—"} | راتب: ${formatCurrency(Number(e.basicSalary))}${e.commissionRate ? ` | عمولة: ${Number(e.commissionRate)}%` : ""}`).join("\n")}`,
        }
      }

      // ── PAYROLL SUMMARY ─────────────────────────────────────────────────────
      case "get_payroll_summary": {
        const [employees, departments] = await Promise.all([
          prisma.employee.findMany({ where: { organizationId: orgId, isActive: true }, select: { name: true, department: true, basicSalary: true, commissionRate: true } }),
          prisma.employee.groupBy({ by: ["department"], where: { organizationId: orgId, isActive: true }, _sum: { basicSalary: true }, _count: { id: true } }),
        ])

        const totalSalaries = employees.reduce((s, e) => s + Number(e.basicSalary), 0)
        const withCommission = employees.filter((e) => e.commissionRate && Number(e.commissionRate) > 0)

        const deptLines = departments
          .filter((d) => d.department)
          .map((d) => `• ${d.department}: ${d._count.id} موظف | رواتب ${formatCurrency(Number(d._sum.basicSalary || 0))}`)
          .join("\n")

        return {
          employeeCount: employees.length,
          totalMonthly: totalSalaries,
          message: `ملخص الرواتب:\n• إجمالي الموظفين: **${employees.length}**\n• إجمالي الرواتب الشهرية: **${formatCurrency(totalSalaries)}**\n• الرواتب السنوية: **${formatCurrency(totalSalaries * 12)}**\n• موظفون بعمولة: ${withCommission.length}\n\nحسب القسم:\n${deptLines || "لا تقسيمات محددة"}`,
        }
      }

      // ── SEARCH INVOICES ─────────────────────────────────────────────────────
      case "search_invoices": {
        const now  = new Date()
        const from = input.period === "week"    ? new Date(now.getTime() - 7 * 86_400_000)
                   : input.period === "month"   ? new Date(now.getFullYear(), now.getMonth(), 1)
                   : input.period === "quarter" ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
                   : input.period === "year"    ? new Date(now.getFullYear(), 0, 1)
                   : undefined

        let contactId: string | undefined
        if (input.customerName) {
          const c = await prisma.contact.findFirst({
            where: { organizationId: orgId, name: { contains: input.customerName, mode: "insensitive" } },
          })
          if (c) contactId = c.id
        }

        const where: Record<string, unknown> = { organizationId: orgId }
        if (contactId)       where.contactId = contactId
        if (input.status)    where.status    = input.status
        if (from)            where.date      = { gte: from }

        const invoices = await prisma.invoice.findMany({
          where: where as any,
          include: { contact: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 20,
        })

        if (!invoices.length) return { message: "لا توجد فواتير تطابق البحث" }

        const total    = invoices.reduce((s, i) => s + Number(i.total), 0)
        const totalDue = invoices.reduce((s, i) => s + Number(i.amountDue), 0)

        return {
          count: invoices.length,
          message: `نتائج البحث (${invoices.length} فاتورة):\n• الإجمالي: **${formatCurrency(total)}** | المستحق: **${formatCurrency(totalDue)}**\n\n${invoices.slice(0, 10).map((i) => `• **${i.number}** — ${i.contact.name}: ${formatCurrency(Number(i.total))} — ${i.status} (${i.date.toLocaleDateString("ar-SA")})`).join("\n")}`,
        }
      }

      // ── CREATE CREDIT NOTE ──────────────────────────────────────────────────
      case "create_credit_note": {
        let contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.customerName, mode: "insensitive" }, type: { in: ["CUSTOMER", "BOTH"] as any } },
        })
        if (!contact) return { error: `لم يُوجد عميل باسم "${input.customerName}"` }

        const amount = round2(Number(input.amount))
        if (amount <= 0) return { error: "المبلغ يجب أن يكون موجباً" }

        const number  = await getNextDocNumber(orgId, "CREDIT_NOTE")
        const today   = new Date()

        // Find related invoice if specified
        let linkedInvoice: { id: string; number: string } | null = null
        if (input.invoiceNumber) {
          linkedInvoice = await prisma.invoice.findFirst({
            where: { organizationId: orgId, number: input.invoiceNumber },
            select: { id: true, number: true },
          }) || null
        }

        const arAccount      = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "ACCOUNTS_RECEIVABLE" } })
        const revenueAccount = await prisma.account.findFirst({ where: { organizationId: orgId, accountType: "REVENUE" } })

        const creditNote = await prisma.invoice.create({
          data: {
            organizationId: orgId,
            contactId: contact.id,
            number,
            type: "CREDIT_NOTE",
            status: "SENT",
            date: today,
            dueDate: today,
            subtotal: -amount, taxAmount: 0, total: -amount,
            amountDue: 0, amountPaid: 0,
            notes: input.reason || null,
            arAccountId: arAccount?.id,
          },
        })

        // Post journal: DR Revenue / CR AR (reduces what customer owes)
        if (arAccount && revenueAccount) {
          await createJournalEntry({
            organizationId: orgId, date: today, type: "GENERAL",
            description: `إشعار خصم ${number} — ${input.reason}`,
            sourceType: "invoice", sourceId: creditNote.id,
            lines: [
              { accountId: revenueAccount.id, debit: amount, credit: 0 },
              { accountId: arAccount.id,      debit: 0,      credit: amount },
            ],
          })
        }

        return {
          success: true, number, amount,
          message: `✅ تم إنشاء إشعار الخصم **${number}** للعميل "${contact.name}" بمبلغ **${formatCurrency(amount)}**${linkedInvoice ? ` — مرتبط بالفاتورة ${linkedInvoice.number}` : ""} — ${input.reason}`,
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

  const systemPrompt = `أنت **محاسب قانوني خبير ومستشار مالي** لشركة "${orgName}". أنت بديل المحاسب اليومي — صاحب الشركة يعتمد عليك في غياب محاسبه. دورك ثلاثي:
1. تُنفّذ المهام المحاسبية مباشرةً (فواتير، دفعات، مصاريف، قيود، شيكات، إشعارات خصم)
2. تُجيب أي سؤال محاسبي يومي (الضريبة، أرصدة الحسابات، الأرباح، الميزانية، من يدين لي، عمولات المندوبين، الرواتب)
3. تُراجع الحسابات وتكتشف الأخطاء استباقياً (استخدم review_books عند السؤال عن صحة الحسابات)

**الفواتير المُنشأة بواسطتك تُرحَّل محاسبياً فوراً**: قيد الذمم المدينة + الإيرادات، قيد تكلفة البضاعة المباعة (إذا منتج مخزوني)، تحديث كميات المخزون، تسجيل عمولة المندوب تلقائياً.

⚠️ حدود مهنية: لا تُقدّم استشارة ضريبية رسمية أو تُقرّ بدل المحاسب القانوني في الأمور المعقّدة (التدقيق، الإقرارات الرسمية، النزاعات). في هذي الحالات نفّذ ما تقدر عليه ثم انصح بمراجعة المحاسب.

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
