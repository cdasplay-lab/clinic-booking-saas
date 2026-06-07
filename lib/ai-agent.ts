import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCurrency } from "./utils"
import { getNextDocNumber, getOrCreateDefaultWarehouse } from "./org"
import { round2 } from "./accounting"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

// ─────────────────────────────────────────────
// FINANCIAL CONTEXT
// ─────────────────────────────────────────────
export async function getFinancialContext(organizationId: string) {
  const now           = new Date()
  const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear   = new Date(now.getFullYear(), 0, 1)
  const startOfWeek   = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfLastWeek  = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  const endOfLastWeek    = new Date(startOfWeek); endOfLastWeek.setDate(startOfWeek.getDate() - 1)

  const [
    weekRevenue, weekExpenses, lastWeekRevenue, lastWeekExpenses,
    monthRevenue, monthExpenses, lastMonthRevenue,
    yearRevenue, yearExpenses,
    overdueInvoices, overdueBills,
    cashAccounts,
    topExpenses, topRevenues,
    recentTransactions,
    employeesCount, totalSalaries,
  ] = await Promise.all([
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "REVENUE" } }, _sum: { credit: true } }),
    prisma.journalLine.aggregate({ where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "EXPENSE" } }, _sum: { debit: true } }),
    prisma.invoice.findMany({ where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, include: { contact: true }, orderBy: { dueDate: "asc" } }),
    prisma.bill.findMany({ where: { organizationId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } }, include: { contact: true }, orderBy: { dueDate: "asc" } }),
    prisma.account.findMany({ where: { organizationId, accountType: { in: ["CASH", "BANK"] } }, include: { journalLines: { where: { journal: { status: "POSTED" } } } } }),
    prisma.account.findMany({ where: { organizationId, accountType: "EXPENSE" }, include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } } }),
    prisma.account.findMany({ where: { organizationId, accountType: "REVENUE" }, include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } } }),
    prisma.journal.findMany({ where: { organizationId }, orderBy: { date: "desc" }, take: 10 }),
    prisma.employee.count({ where: { organizationId, isActive: true } }),
    prisma.employee.aggregate({ where: { organizationId, isActive: true }, _sum: { basicSalary: true } }),
  ])

  const cashBalance  = cashAccounts.reduce((t, a) => t + Number(a.openingBalance) + a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0), 0)
  const wRev  = Number(weekRevenue._sum.credit   || 0)
  const wExp  = Number(weekExpenses._sum.debit   || 0)
  const lwRev = Number(lastWeekRevenue._sum.credit || 0)
  const mRev  = Number(monthRevenue._sum.credit  || 0)
  const mExp  = Number(monthExpenses._sum.debit  || 0)
  const lmRev = Number(lastMonthRevenue._sum.credit || 0)
  const ytdRev  = Number(yearRevenue._sum.credit || 0)
  const ytdExp  = Number(yearExpenses._sum.debit || 0)

  const revenueChangeWeek  = lwRev > 0 ? ((wRev - lwRev) / lwRev * 100).toFixed(1) : "—"
  const revenueChangeMonth = lmRev > 0 ? ((mRev - lmRev) / lmRev * 100).toFixed(1) : "—"

  const expBreak = topExpenses.map((a) => ({ name: a.name, amount: a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) })).filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)
  const revBreak = topRevenues.map((a) => ({ name: a.name, amount: a.journalLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0) })).filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)

  return `
## ملخص هذا الأسبوع:
- الإيرادات: ${formatCurrency(wRev)} (${revenueChangeWeek}% مقارنة بالأسبوع الماضي)
- المصروفات: ${formatCurrency(wExp)} | صافي: ${formatCurrency(wRev - wExp)}

## ملخص هذا الشهر:
- الإيرادات: ${formatCurrency(mRev)} (${revenueChangeMonth}% مقارنة بالشهر الماضي)
- المصروفات: ${formatCurrency(mExp)} | صافي: ${formatCurrency(mRev - mExp)}

## السنة حتى الآن:
- إيرادات: ${formatCurrency(ytdRev)} | مصروفات: ${formatCurrency(ytdExp)} | صافي: ${formatCurrency(ytdRev - ytdExp)}
- هامش الربح: ${ytdRev > 0 ? ((ytdRev - ytdExp) / ytdRev * 100).toFixed(1) : 0}%

## الوضع النقدي: ${formatCurrency(cashBalance)}
${cashBalance < Number(totalSalaries._sum.basicSalary || 0) ? "⚠️ تحذير: الرصيد أقل من مجموع الرواتب!" : "✓ يكفي لتغطية الرواتب"}

## مستحقات العملاء: ${formatCurrency(overdueInvoices.reduce((s, i) => s + Number(i.amountDue), 0))} (${overdueInvoices.length} فاتورة)
${overdueInvoices.slice(0, 5).map((i) => `  - ${i.contact.name}: ${formatCurrency(Number(i.amountDue))}`).join("\n")}

## مستحقات للموردين: ${formatCurrency(overdueBills.reduce((s, b) => s + Number(b.amountDue), 0))} (${overdueBills.length} فاتورة)
${overdueBills.slice(0, 5).map((b) => `  - ${b.contact.name}: ${formatCurrency(Number(b.amountDue))}`).join("\n")}

## أكبر مصادر الإيرادات:
${revBreak.slice(0, 5).map((r) => `- ${r.name}: ${formatCurrency(r.amount)}`).join("\n") || "لا بيانات"}

## أكبر المصروفات:
${expBreak.slice(0, 5).map((e) => `- ${e.name}: ${formatCurrency(e.amount)}`).join("\n") || "لا بيانات"}

## الموارد البشرية: ${employeesCount} موظف | رواتب: ${formatCurrency(Number(totalSalaries._sum.basicSalary || 0))}/شهر

## آخر العمليات:
${recentTransactions.map((j) => `- ${j.date.toLocaleDateString("ar-SA")} | ${j.number}: ${j.description} (${formatCurrency(Number(j.totalDebit))})`).join("\n")}
`
}

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// ─────────────────────────────────────────────
const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_invoice",
    description: "ينشئ فاتورة بيع جديدة للعميل. استخدم هذا عندما يطلب المستخدم تسجيل فاتورة أو بيع لعميل.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactName: { type: "string", description: "اسم العميل" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "وصف المنتج أو الخدمة" },
              quantity:    { type: "number", description: "الكمية" },
              unitPrice:   { type: "number", description: "سعر الوحدة" },
            },
            required: ["description", "quantity", "unitPrice"],
          },
          description: "بنود الفاتورة",
        },
        dueDate: { type: "string", description: "تاريخ الاستحقاق بصيغة YYYY-MM-DD (اختياري)" },
        notes:   { type: "string", description: "ملاحظات إضافية (اختيارية)" },
      },
      required: ["contactName", "items"],
    },
  },
  {
    name: "create_bill",
    description: "ينشئ فاتورة مورد (مشتريات) جديدة. استخدم عندما يريد المستخدم تسجيل فاتورة من مورد أو تسجيل مشتريات.",
    input_schema: {
      type: "object" as const,
      properties: {
        vendorName: { type: "string", description: "اسم المورد" },
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
        dueDate: { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD (اختياري)" },
        notes:   { type: "string" },
      },
      required: ["vendorName", "items"],
    },
  },
  {
    name: "check_stock",
    description: "يفحص الكمية الحالية في المخزون لمنتج معين. استخدم عندما يسأل المستخدم عن مخزون منتج.",
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
    description: "يبحث عن منتجات في قائمة المخزون",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "كلمة البحث (اسم أو كود)" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_contacts",
    description: "يبحث عن عملاء أو موردين",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "اسم العميل أو المورد" },
        type:  { type: "string", enum: ["CUSTOMER", "VENDOR", "BOTH"], description: "نوع جهة الاتصال" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pos_summary",
    description: "يجلب ملخص مبيعات نقطة البيع لتاريخ معين",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "التاريخ بصيغة YYYY-MM-DD (اليوم إذا فارغ)" },
      },
      required: [],
    },
  },
]

// ─────────────────────────────────────────────
// TOOL EXECUTION
// ─────────────────────────────────────────────
async function executeTool(toolName: string, input: any, orgId: string): Promise<any> {
  try {
    switch (toolName) {

      case "create_invoice": {
        // Find or create contact
        let contact = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.contactName, mode: "insensitive" }, type: { in: ["CUSTOMER", "BOTH"] } },
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
          subtotal += total
          return { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxAmount: 0, total, sortOrder: idx }
        })
        subtotal = round2(subtotal)

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

        return { success: true, number, total: subtotal, message: `✅ تم إنشاء الفاتورة ${number} للعميل "${contact.name}" بمبلغ ${formatCurrency(subtotal)} — الحالة: مسودة` }
      }

      case "create_bill": {
        let vendor = await prisma.contact.findFirst({
          where: { organizationId: orgId, name: { contains: input.vendorName, mode: "insensitive" }, type: { in: ["VENDOR", "BOTH"] } },
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
          subtotal += total
          return { description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxAmount: 0, total, sortOrder: idx }
        })
        subtotal = round2(subtotal)

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

        return { success: true, number, total: subtotal, message: `✅ تم إنشاء فاتورة المورد ${number} من "${vendor.name}" بمبلغ ${formatCurrency(subtotal)} — الحالة: مسودة` }
      }

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

        const stock = product.stockLedger.reduce((sum, s) => {
          if (s.type === "IN")         return sum + Number(s.quantity)
          if (s.type === "OUT")        return sum - Number(s.quantity)
          if (s.type === "ADJUSTMENT") return sum + Number(s.quantity)
          return sum
        }, 0)

        const isLow = stock <= Number(product.reorderLevel)
        return {
          productName: product.name,
          code:        product.code,
          stock,
          unit:        product.unit,
          salePrice:   Number(product.salePrice),
          reorderLevel: Number(product.reorderLevel),
          status: isLow ? "⚠️ منخفض" : "✓ متوفر",
          message: `مخزون "${product.name}": ${stock} ${product.unit} — سعر البيع: ${formatCurrency(Number(product.salePrice))} ${isLow ? "⚠️ المخزون منخفض!" : ""}`,
        }
      }

      case "search_products": {
        const products = await prisma.product.findMany({
          where: {
            organizationId: orgId,
            isActive: true,
            OR: [
              { name:    { contains: input.query, mode: "insensitive" } },
              { code:    { contains: input.query, mode: "insensitive" } },
              { category: { contains: input.query, mode: "insensitive" } },
            ],
          },
          select: { name: true, code: true, salePrice: true, purchasePrice: true, unit: true, category: true },
          take: 10,
        })

        if (!products.length) return { message: `لا توجد منتجات تطابق "${input.query}"` }
        return {
          products: products.map((p) => `${p.name} (${p.code}) — بيع: ${formatCurrency(Number(p.salePrice))} | شراء: ${formatCurrency(Number(p.purchasePrice))} | ${p.unit}`),
          count: products.length,
        }
      }

      case "search_contacts": {
        const contacts = await prisma.contact.findMany({
          where: {
            organizationId: orgId,
            isActive: true,
            name: { contains: input.query, mode: "insensitive" },
            ...(input.type ? { type: { in: input.type === "VENDOR" ? ["VENDOR", "BOTH"] : input.type === "CUSTOMER" ? ["CUSTOMER", "BOTH"] : ["CUSTOMER", "VENDOR", "BOTH"] } } : {}),
          },
          select: { name: true, type: true, phone: true, email: true },
          take: 10,
        })

        if (!contacts.length) return { message: `لا توجد جهات اتصال تطابق "${input.query}"` }
        return { contacts: contacts.map((c) => `${c.name} (${c.type}) ${c.phone || ""}`) }
      }

      case "get_pos_summary": {
        const dateStr = input.date || new Date().toISOString().slice(0, 10)
        const from = new Date(dateStr + "T00:00:00.000Z")
        const to   = new Date(dateStr + "T23:59:59.999Z")

        const txs = await prisma.posTransaction.findMany({
          where: { organizationId: orgId, date: { gte: from, lte: to }, status: "COMPLETED" },
        })

        const total = txs.reduce((s, t) => s + Number(t.total), 0)
        const cash  = txs.filter((t) => t.paymentMethod === "CASH").reduce((s, t) => s + Number(t.total), 0)
        const card  = txs.filter((t) => t.paymentMethod === "CARD").reduce((s, t) => s + Number(t.total), 0)

        return {
          date: dateStr,
          totalSales:  formatCurrency(total),
          txCount:     txs.length,
          cash:        formatCurrency(cash),
          card:        formatCurrency(card),
          message: `مبيعات POS بتاريخ ${dateStr}:\n- الإجمالي: ${formatCurrency(total)}\n- العمليات: ${txs.length}\n- نقدي: ${formatCurrency(cash)} | بطاقة: ${formatCurrency(card)}`,
        }
      }

      default:
        return { error: `أداة غير معروفة: ${toolName}` }
    }
  } catch (e: any) {
    return { error: `خطأ في تنفيذ الأداة: ${e.message}` }
  }
}

// ─────────────────────────────────────────────
// MAIN AI AGENT — AGENTIC LOOP WITH TOOL USE
// ─────────────────────────────────────────────
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
    ? `ضريبة القيمة المضافة: ${country.vatRate}% (${country.vatName})`
    : `لا ضريبة قيمة مضافة في ${country.nameAr}`

  const systemPrompt = `أنت مساعد محاسبي ومالي ذكي لشركة "${orgName}". أنت خبير محاسب قانوني ومستشار مالي.

معلومات الشركة:
- الدولة: ${country.flag} ${country.nameAr} | العملة: ${country.currencyAr} (${country.currencySymbol})
- ${vatNote}

البيانات المالية الحالية:
${context}

قدراتك:
1. **تحليل مالي**: تحليل الإيرادات والمصروفات مع مقارنة الفترات
2. **إنشاء فواتير**: تستطيع إنشاء فواتير بيع وفواتير موردين مباشرةً
3. **فحص المخزون**: تفحص الكميات المتاحة وتنبّه للنقص
4. **تسجيل المشتريات**: تسجّل فواتير الموردين عند استلام البضائع
5. **تشخيص المشاكل**: تحلل أسباب تراجع الأرباح
6. **تنبيهات فورية**: فواتير متأخرة، نقص سيولة، مخزون منخفض

قواعد مهمة:
- إذا طلب المستخدم إنشاء فاتورة أو تسجيل بيع/شراء → استخدم الأداة المناسبة مباشرةً
- استخدم الأرقام الحقيقية من البيانات
- اعرض المبالغ بعملة الشركة (${country.currencySymbol})
- أجب بنفس لغة المستخدم (عربي/إنجليزي/عامية)
- بعد إنشاء أي مستند، اذكر رقمه وإجماليه`

  // Build messages
  type MsgParam = Anthropic.MessageParam
  let messages: MsgParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as MsgParam)),
    { role: "user", content: message },
  ]

  // Agentic loop
  let iterations = 0
  while (iterations < 5) {
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
      // Add assistant's response (with tool_use blocks)
      messages.push({ role: "assistant", content: response.content })

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input, organizationId)
          toolResults.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          })
        }
      }

      messages.push({ role: "user", content: toolResults })
      continue
    }

    // Unexpected stop reason
    break
  }

  return "عذراً، لم أتمكن من إكمال الطلب. حاول مرة أخرى."
}
