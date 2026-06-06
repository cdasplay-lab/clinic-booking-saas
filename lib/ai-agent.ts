import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCurrency } from "./utils"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

export async function getFinancialContext(organizationId: string) {
  const now = new Date()
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const startOfLastWeek = new Date(startOfWeek); startOfLastWeek.setDate(startOfWeek.getDate() - 7)
  const endOfLastWeek = new Date(startOfWeek); endOfLastWeek.setDate(startOfWeek.getDate() - 1)

  const [
    weekRevenue, weekExpenses, lastWeekRevenue, lastWeekExpenses,
    monthRevenue, monthExpenses, lastMonthRevenue, lastMonthExpenses,
    yearRevenue, yearExpenses,
    overdueInvoices, overdueBills,
    cashAccounts, allAccounts,
    topExpenses, topRevenues,
    recentTransactions,
    employeesCount, totalSalaries,
  ] = await Promise.all([
    // This week revenue
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    // This week expenses
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    // Last week revenue
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    // Last week expenses
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfLastWeek, lte: endOfLastWeek }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    // This month revenue
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    // This month expenses
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    // Last month revenue
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    // Last month expenses
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfLastMonth, lte: endOfLastMonth }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    // YTD Revenue
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "REVENUE" } },
      _sum: { credit: true },
    }),
    // YTD Expenses
    prisma.journalLine.aggregate({
      where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" }, account: { accountType: "EXPENSE" } },
      _sum: { debit: true },
    }),
    // Overdue invoices
    prisma.invoice.findMany({
      where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
    }),
    // Overdue bills
    prisma.bill.findMany({
      where: { organizationId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
    }),
    // Cash + Bank balances
    prisma.account.findMany({
      where: { organizationId, accountType: { in: ["CASH", "BANK"] } },
      include: { journalLines: { where: { journal: { status: "POSTED" } } } },
    }),
    // All accounts with balances
    prisma.account.findMany({
      where: { organizationId, isActive: true },
      include: { journalLines: { where: { journal: { status: "POSTED" } } } },
      orderBy: { code: "asc" },
    }),
    // Top expense accounts this year
    prisma.account.findMany({
      where: { organizationId, accountType: "EXPENSE" },
      include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } },
    }),
    // Top revenue sources this year
    prisma.account.findMany({
      where: { organizationId, accountType: "REVENUE" },
      include: { journalLines: { where: { journal: { organizationId, date: { gte: startOfYear }, status: "POSTED" } } } },
    }),
    // Recent journals
    prisma.journal.findMany({
      where: { organizationId },
      orderBy: { date: "desc" },
      take: 15,
    }),
    // Employees
    prisma.employee.count({ where: { organizationId, isActive: true } }),
    // Total salaries
    prisma.employee.aggregate({ where: { organizationId, isActive: true }, _sum: { basicSalary: true } }),
  ])

  // Calculate balances
  const cashBalance = cashAccounts.reduce((total, acc) => {
    const debit = acc.journalLines.reduce((s, l) => s + Number(l.debit), 0)
    const credit = acc.journalLines.reduce((s, l) => s + Number(l.credit), 0)
    const opening = Number(acc.openingBalance)
    return total + (opening + debit - credit)
  }, 0)

  const wRevenue = Number(weekRevenue._sum.credit || 0)
  const wExpenses = Number(weekExpenses._sum.debit || 0)
  const lwRevenue = Number(lastWeekRevenue._sum.credit || 0)
  const lwExpenses = Number(lastWeekExpenses._sum.debit || 0)
  const mRevenue = Number(monthRevenue._sum.credit || 0)
  const mExpenses = Number(monthExpenses._sum.debit || 0)
  const lmRevenue = Number(lastMonthRevenue._sum.credit || 0)
  const lmExpenses = Number(lastMonthExpenses._sum.debit || 0)
  const ytdRevenue = Number(yearRevenue._sum.credit || 0)
  const ytdExpenses = Number(yearExpenses._sum.debit || 0)

  const revenueChangeWeek = lwRevenue > 0 ? ((wRevenue - lwRevenue) / lwRevenue * 100).toFixed(1) : "لا يوجد مقارنة"
  const revenueChangeMonth = lmRevenue > 0 ? ((mRevenue - lmRevenue) / lmRevenue * 100).toFixed(1) : "لا يوجد مقارنة"

  const totalReceivables = overdueInvoices.reduce((s, i) => s + Number(i.amountDue), 0)
  const totalPayables = overdueBills.reduce((s, i) => s + Number(i.amountDue), 0)
  const overdueReceivables = overdueInvoices.filter((i) => i.dueDate < now).reduce((s, i) => s + Number(i.amountDue), 0)
  const overduePayables = overdueBills.filter((b) => b.dueDate < now).reduce((s, b) => s + Number(b.amountDue), 0)

  const expenseBreakdown = topExpenses
    .map((a) => ({ name: a.name, amount: a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0) }))
    .filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)

  const revenueBreakdown = topRevenues
    .map((a) => ({ name: a.name, amount: a.journalLines.reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0) }))
    .filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)

  return `
## 📊 ملخص هذا الأسبوع:
- الإيرادات: ${formatCurrency(wRevenue)} (${Number(revenueChangeWeek) > 0 ? "↑" : "↓"} ${revenueChangeWeek}% مقارنة بالأسبوع الماضي)
- المصروفات: ${formatCurrency(wExpenses)}
- صافي الربح الأسبوعي: ${formatCurrency(wRevenue - wExpenses)}

## 📊 ملخص هذا الشهر:
- الإيرادات: ${formatCurrency(mRevenue)} (${Number(revenueChangeMonth) > 0 ? "↑" : "↓"} ${revenueChangeMonth}% مقارنة بالشهر الماضي)
- مصروفات الشهر الماضي: ${formatCurrency(lmExpenses)}
- المصروفات: ${formatCurrency(mExpenses)}
- صافي الربح: ${formatCurrency(mRevenue - mExpenses)}

## 📊 ملخص هذه السنة (حتى الآن):
- إجمالي الإيرادات: ${formatCurrency(ytdRevenue)}
- إجمالي المصروفات: ${formatCurrency(ytdExpenses)}
- صافي الربح السنوي: ${formatCurrency(ytdRevenue - ytdExpenses)}
- هامش الربح: ${ytdRevenue > 0 ? ((ytdRevenue - ytdExpenses) / ytdRevenue * 100).toFixed(1) : 0}%

## 💰 الوضع النقدي:
- الرصيد النقدي (صندوق + بنك): ${formatCurrency(cashBalance)}
- ${cashBalance < Number(totalSalaries._sum.basicSalary || 0) ? "⚠️ تحذير: الرصيد أقل من مجموع الرواتب الشهرية!" : "✓ الرصيد كافٍ لتغطية الرواتب"}

## 👥 المبالغ المستحقة من العملاء:
- إجمالي المستحق: ${formatCurrency(totalReceivables)} (${overdueInvoices.length} فاتورة)
- منها متأخرة: ${formatCurrency(overdueReceivables)}
${overdueInvoices.slice(0, 5).map((i) => `  - ${i.contact.name}: ${formatCurrency(Number(i.amountDue))} (استحقت ${i.dueDate.toLocaleDateString("ar-SA")})`).join("\n")}

## 🏦 المبالغ المستحقة للموردين:
- إجمالي المستحق: ${formatCurrency(totalPayables)} (${overdueBills.length} فاتورة)
- منها متأخرة: ${formatCurrency(overduePayables)}
${overdueBills.slice(0, 5).map((b) => `  - ${b.contact.name}: ${formatCurrency(Number(b.amountDue))} (استحقت ${b.dueDate.toLocaleDateString("ar-SA")})`).join("\n")}

## 📈 أكبر مصادر الإيرادات (هذه السنة):
${revenueBreakdown.slice(0, 5).map((r) => `- ${r.name}: ${formatCurrency(r.amount)}`).join("\n") || "لا توجد بيانات"}

## 📉 أكبر بنود المصروفات (هذه السنة):
${expenseBreakdown.slice(0, 5).map((e) => `- ${e.name}: ${formatCurrency(e.amount)}`).join("\n") || "لا توجد بيانات"}

## 👨‍💼 الموارد البشرية:
- عدد الموظفين: ${employeesCount}
- إجمالي الرواتب الشهرية: ${formatCurrency(Number(totalSalaries._sum.basicSalary || 0))}

## 🔄 آخر ${recentTransactions.length} عملية:
${recentTransactions.map((j) => `- [${j.date.toLocaleDateString("ar-SA")}] ${j.number}: ${j.description} (${formatCurrency(Number(j.totalDebit))})`).join("\n")}
`
}

export async function runAIAgent(
  message: string,
  organizationId: string,
  orgName: string,
  history: Array<{ role: "user" | "assistant", content: string }>,
  countryCode = "SA",
) {
  const { getCountry } = await import("./countries")
  const country = getCountry(countryCode)
  const context = await getFinancialContext(organizationId)

  const vatNote = country.vatEnabled
    ? `ضريبة القيمة المضافة المطبّقة: ${country.vatRate}% (${country.vatName})`
    : `لا ضريبة قيمة مضافة في ${country.nameAr}`

  const systemPrompt = `أنت مساعد محاسبي ومالي ذكي لشركة "${orgName}". أنت خبير محاسب قانوني ومستشار مالي.

معلومات الشركة:
- الدولة: ${country.flag} ${country.nameAr}
- العملة: ${country.currencyAr} (${country.currencySymbol})
- ${vatNote}

لديك البيانات المالية الحقيقية والمحدّثة للشركة:

${context}

قدراتك:
1. **تحليل الأرباح**: تحليل دقيق للإيرادات والمصروفات مع المقارنة الأسبوعية والشهرية والسنوية
2. **تشخيص المشاكل**: إذا سألك "ليش نازل أرباحي؟" — تحلل البيانات وتعطي أسباب حقيقية
3. **التنبيه للمخاطر**: فواتير متأخرة، نقص سيولة، مصروفات مرتفعة
4. **التوصيات المالية**: نصائح عملية لتحسين الربحية
5. **الإجابة بأي لغة**: عربي، إنجليزي، أو أي لغة يكتب بها المستخدم
6. **الحسابات الفورية**: تحسب أي رقم يطلبه بناءً على البيانات الحقيقية

قواعد الإجابة:
- استخدم الأرقام الحقيقية دائماً من البيانات أعلاه
- اعرض المبالغ دائماً بعملة الشركة (${country.currencySymbol})
- قارن الفترات (أسبوع بأسبوع، شهر بشهر، سنة بسنة)
- إذا انخفضت الأرباح، حدّد السبب: هل زادت المصروفات؟ أم انخفضت الإيرادات؟
- نبّه للمخاطر بوضوح
- قدم توصيات قابلة للتنفيذ
- نسّق إجاباتك بشكل واضح مع أرقام وأيقونات
- إذا سأل بالإنجليزية أجب بالإنجليزية، بالعربية أجب بالعربية`

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...history,
      { role: "user", content: message },
    ],
  })

  return response.content[0].type === "text" ? response.content[0].text : "عذراً، حدث خطأ في المعالجة."
}
