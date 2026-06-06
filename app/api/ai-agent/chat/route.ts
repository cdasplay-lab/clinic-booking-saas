import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { formatCurrency } from "@/lib/utils"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, conversationId, organizationId } = await req.json()

  if (!message || !organizationId) {
    return NextResponse.json({ error: "Message and organizationId required" }, { status: 400 })
  }

  // Verify user has access to this organization
  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Access denied" }, { status: 403 })

  // Get or create conversation
  let convId = conversationId
  if (!convId) {
    const conv = await prisma.aIConversation.create({
      data: {
        organizationId,
        userId: session.user.id,
        title: message.slice(0, 50),
      },
    })
    convId = conv.id
  }

  // Save user message
  await prisma.aIMessage.create({
    data: { conversationId: convId, role: "USER", content: message },
  })

  // Get conversation history
  const history = await prisma.aIMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  })

  // Gather financial context
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const [
    overdueInvoices,
    overdueBills,
    recentJournals,
    monthlyRevenue,
    monthlyExpenses,
    cashBalance,
    topExpenses,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.bill.findMany({
      where: { organizationId, status: { in: ["OPEN", "PARTIAL", "OVERDUE"] } },
      include: { contact: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.journal.findMany({
      where: { organizationId },
      orderBy: { date: "desc" },
      take: 10,
    }),
    prisma.journalLine.aggregate({
      where: {
        journal: {
          organizationId,
          date: { gte: startOfMonth },
          status: "POSTED",
        },
        account: { accountType: "REVENUE" },
      },
      _sum: { credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        journal: {
          organizationId,
          date: { gte: startOfMonth },
          status: "POSTED",
        },
        account: { accountType: "EXPENSE" },
      },
      _sum: { debit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        journal: { organizationId, status: "POSTED" },
        account: { accountType: { in: ["CASH", "BANK"] } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.account.findMany({
      where: { organizationId, accountType: "EXPENSE" },
      include: {
        journalLines: {
          where: {
            journal: {
              organizationId,
              date: { gte: startOfYear },
              status: "POSTED",
            },
          },
        },
      },
    }),
  ])

  const revenue = Number(monthlyRevenue._sum.credit || 0)
  const expenses = Number(monthlyExpenses._sum.debit || 0)
  const cash = Number(cashBalance._sum.debit || 0) - Number(cashBalance._sum.credit || 0)
  const totalReceivables = overdueInvoices.reduce((s, i) => s + Number(i.amountDue), 0)
  const totalPayables = overdueBills.reduce((s, i) => s + Number(i.amountDue), 0)

  const expensesByAccount = topExpenses
    .map((a) => ({
      name: a.name,
      amount: a.journalLines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const financialContext = `
# البيانات المالية لشركة: ${userOrg.organization.name}
التاريخ: ${now.toLocaleDateString("ar-SA")}

## ملخص هذا الشهر:
- الإيرادات: ${formatCurrency(revenue)}
- المصروفات: ${formatCurrency(expenses)}
- صافي الربح: ${formatCurrency(revenue - expenses)}
- الرصيد النقدي: ${formatCurrency(cash)}

## المبالغ المستحقة:
- من العملاء: ${formatCurrency(totalReceivables)} (${overdueInvoices.length} فاتورة)
- للموردين: ${formatCurrency(totalPayables)} (${overdueBills.length} فاتورة)

## تفاصيل الفواتير المستحقة من العملاء:
${overdueInvoices.map((i) => `- ${i.contact.name}: ${formatCurrency(Number(i.amountDue))} (استحقت ${i.dueDate.toLocaleDateString("ar-SA")})`).join("\n") || "لا توجد"}

## الفواتير المستحقة للموردين:
${overdueBills.map((b) => `- ${b.contact.name}: ${formatCurrency(Number(b.amountDue))} (استحقت ${b.dueDate.toLocaleDateString("ar-SA")})`).join("\n") || "لا توجد"}

## أكبر بنود المصروفات هذه السنة:
${expensesByAccount.map((e) => `- ${e.name}: ${formatCurrency(e.amount)}`).join("\n") || "لا توجد بيانات"}

## آخر القيود المحاسبية:
${recentJournals.map((j) => `- ${j.number}: ${j.description} (${formatCurrency(Number(j.totalDebit))})`).join("\n")}
`

  const systemPrompt = `أنت مساعد محاسبي ذكي متخصص في المحاسبة المالية وإدارة الأعمال. أنت تعمل لصالح شركة "${userOrg.organization.name}".

لديك وصول كامل للبيانات المالية الحقيقية للشركة وهي:

${financialContext}

مهامك:
1. الإجابة على الأسئلة المالية بدقة استناداً للبيانات الحقيقية أعلاه
2. تقديم تحليلات وتوصيات مالية عملية
3. مساعدة في تفسير التقارير المالية
4. التنبيه للمخاطر المالية (فواتير متأخرة، تدفق نقدي منخفض)
5. شرح المبادئ المحاسبية بشكل مبسط
6. تحليل الاتجاهات والأنماط المالية

قواعد الإجابة:
- استخدم الأرقام الحقيقية من البيانات المقدمة
- كن دقيقاً في الحسابات
- قدم توصيات عملية قابلة للتنفيذ
- استخدم العربية الواضحة
- نسّق إجاباتك بشكل منظم مع نقاط وعناوين
- أضف تحذيرات عند وجود مخاطر مالية
- إذا سأل عن شيء خارج البيانات المتاحة، أخبره بذلك بوضوح`

  const messages = history.slice(0, -1).map((m) => ({
    role: m.role === "USER" ? "user" as const : "assistant" as const,
    content: m.content,
  }))

  messages.push({ role: "user", content: message })

  const response = await anthropic.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  const assistantResponse =
    response.content[0].type === "text"
      ? response.content[0].text
      : "عذراً، لم أستطع معالجة طلبك."

  // Save assistant message
  await prisma.aIMessage.create({
    data: { conversationId: convId, role: "ASSISTANT", content: assistantResponse },
  })

  return NextResponse.json({ response: assistantResponse, conversationId: convId })
}
