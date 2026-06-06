import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "./prisma"
import { formatCurrency } from "./utils"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" })

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
) {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error("WhatsApp send error:", err)
    throw new Error(`WhatsApp error: ${JSON.stringify(err)}`)
  }

  return await res.json()
}

export async function extractTransactionFromMessage(message: string, orgContext: string): Promise<{
  type: "INVOICE" | "BILL" | "PAYMENT" | "EXPENSE" | "JOURNAL" | "UNKNOWN"
  description: string
  amount: number
  currency: string
  contactName: string
  date: string
  category: string
  confidence: number
  arabicSummary: string
} | null> {
  const prompt = `أنت مساعد محاسبي. حلّل هذه الرسالة واستخرج منها معلومات العملية المالية.

معلومات الشركة: ${orgContext}

الرسالة: "${message}"

استخرج المعلومات التالية بتنسيق JSON فقط (بدون أي نص إضافي):
{
  "type": "INVOICE|BILL|PAYMENT|EXPENSE|JOURNAL|UNKNOWN",
  "description": "وصف العملية",
  "amount": الرقم فقط بدون رموز,
  "currency": "SAR",
  "contactName": "اسم العميل أو المورد",
  "date": "YYYY-MM-DD (اليوم إذا لم يُذكر)",
  "category": "مبيعات|مشتريات|مصروفات|رواتب|إيجار|كهرباء|أخرى",
  "confidence": رقم من 0 إلى 100,
  "arabicSummary": "ملخص بالعربي في سطر واحد"
}

أنواع العمليات:
- INVOICE: بيع أو إيراد (مبيعات، فاتورة، عميل دفع، إيراد)
- BILL: شراء من مورد (مشتريات، فاتورة مورد)
- PAYMENT: دفعة أو استلام مال
- EXPENSE: مصروف (إيجار، كهرباء، رواتب، مواصلات)
- JOURNAL: قيد محاسبي عام
- UNKNOWN: رسالة غير مالية

إذا لم تجد أي عملية مالية واضحة، أعد: {"type": "UNKNOWN", "confidence": 0, "arabicSummary": "لا يوجد عملية مالية", "amount": 0, "currency": "SAR", "contactName": "", "date": "${new Date().toISOString().split("T")[0]}", "category": "أخرى", "description": ""}

الرسالة المطلوب تحليلها مرة أخرى: "${message}"`

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.type === "UNKNOWN" || parsed.confidence < 30) return null
    return parsed
  } catch {
    return null
  }
}

export function buildVerificationMessage(data: {
  type: string
  description: string
  amount: number
  currency: string
  contactName: string
  date: string
  category: string
  arabicSummary: string
  pendingId: string
}): string {
  const typeIcons: Record<string, string> = {
    INVOICE: "📤 مبيعات",
    BILL: "📥 مشتريات",
    PAYMENT: "💸 دفعة",
    EXPENSE: "💰 مصروف",
    JOURNAL: "📒 قيد",
  }

  const icon = typeIcons[data.type] || "📋 عملية"

  return `━━━━━━━━━━━━━━━━━━━━━
📊 *HesabPro - تدقيق العملية*
━━━━━━━━━━━━━━━━━━━━━

🔍 *الرسالة المكتشفة:*
${data.arabicSummary}

━━━━━━━━━━━━━━━━━━━━━
📋 *تفاصيل العملية:*
${icon}
💰 المبلغ: *${formatCurrency(data.amount)}*
${data.contactName ? `👤 الطرف: *${data.contactName}*` : ""}
📅 التاريخ: *${new Date(data.date).toLocaleDateString("ar-SA")}*
🏷️ الفئة: *${data.category}*
${data.description ? `📝 الوصف: ${data.description}` : ""}

━━━━━━━━━━━━━━━━━━━━━
✅ رد بـ *تأكيد ${data.pendingId.slice(-6)}* للتسجيل
❌ رد بـ *رفض ${data.pendingId.slice(-6)}* للإلغاء
━━━━━━━━━━━━━━━━━━━━━`
}

export async function processConfirmation(pendingId: string, confirmedBy: string) {
  const pending = await prisma.pendingTransaction.findUnique({
    where: { id: pendingId },
    include: { organization: { include: { accounts: true } }, whatsappInt: true },
  })

  if (!pending || pending.status !== "WAITING") return null

  const data = pending.parsedData as any

  // Find appropriate accounts
  const orgId = pending.organizationId
  const accounts = pending.organization.accounts

  const cashAccount = accounts.find((a) => a.accountType === "CASH" || a.accountType === "BANK")
  const arAccount = accounts.find((a) => a.accountType === "ACCOUNTS_RECEIVABLE")
  const apAccount = accounts.find((a) => a.accountType === "ACCOUNTS_PAYABLE")
  const revenueAccount = accounts.find((a) => a.accountType === "REVENUE")
  const expenseAccount = accounts.find((a) => a.accountType === "EXPENSE")

  let result: { success: boolean; message: string; type: string } = { success: false, message: "", type: "" }

  const { createJournalEntry } = await import("./accounting")
  const { getNextDocNumber } = await import("./org")

  try {
    if (data.type === "INVOICE" && arAccount && revenueAccount) {
      // Find or create contact
      let contact = await prisma.contact.findFirst({
        where: { organizationId: orgId, name: { contains: data.contactName } },
      })
      if (!contact && data.contactName) {
        contact = await prisma.contact.create({
          data: { organizationId: orgId, name: data.contactName, type: "CUSTOMER" },
        })
      }

      if (contact) {
        const number = await getNextDocNumber(orgId, "INVOICE")
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: orgId,
            contactId: contact.id,
            number,
            date: new Date(data.date),
            dueDate: new Date(Date.now() + 30 * 86400000),
            subtotal: data.amount,
            taxAmount: 0,
            total: data.amount,
            amountDue: data.amount,
            status: "SENT",
            notes: `تم الإنشاء من واتساب: ${pending.originalMessage}`,
          },
        })

        await createJournalEntry({
          organizationId: orgId,
          date: new Date(data.date),
          type: "SALES",
          description: `مبيعات: ${data.description || data.arabicSummary}`,
          sourceType: "invoice",
          sourceId: invoice.id,
          lines: [
            { accountId: arAccount.id, debit: data.amount, credit: 0 },
            { accountId: revenueAccount.id, debit: 0, credit: data.amount },
          ],
        })

        result = { success: true, message: `✅ تم تسجيل الفاتورة رقم ${number}`, type: "invoice" }

        await prisma.pendingTransaction.update({
          where: { id: pendingId },
          data: { status: "POSTED", confirmedAt: new Date(), confirmedBy, invoiceId: invoice.id },
        })
      }
    } else if (data.type === "BILL" && apAccount && expenseAccount) {
      let contact = await prisma.contact.findFirst({
        where: { organizationId: orgId, name: { contains: data.contactName } },
      })
      if (!contact && data.contactName) {
        contact = await prisma.contact.create({
          data: { organizationId: orgId, name: data.contactName, type: "VENDOR" },
        })
      }

      if (contact) {
        const number = await getNextDocNumber(orgId, "BILL")
        const bill = await prisma.bill.create({
          data: {
            organizationId: orgId,
            contactId: contact.id,
            number,
            date: new Date(data.date),
            dueDate: new Date(Date.now() + 30 * 86400000),
            subtotal: data.amount,
            taxAmount: 0,
            total: data.amount,
            amountDue: data.amount,
            status: "OPEN",
            notes: `تم الإنشاء من واتساب: ${pending.originalMessage}`,
          },
        })

        await createJournalEntry({
          organizationId: orgId,
          date: new Date(data.date),
          type: "PURCHASE",
          description: `مشتريات: ${data.description || data.arabicSummary}`,
          lines: [
            { accountId: expenseAccount.id, debit: data.amount, credit: 0 },
            { accountId: apAccount.id, debit: 0, credit: data.amount },
          ],
        })

        result = { success: true, message: `✅ تم تسجيل فاتورة المورد رقم ${number}`, type: "bill" }

        await prisma.pendingTransaction.update({
          where: { id: pendingId },
          data: { status: "POSTED", confirmedAt: new Date(), confirmedBy, billId: bill.id },
        })
      }
    } else if (data.type === "EXPENSE" && expenseAccount && cashAccount) {
      const journal = await createJournalEntry({
        organizationId: orgId,
        date: new Date(data.date),
        type: "PAYMENT",
        description: `مصروف: ${data.description || data.arabicSummary}`,
        lines: [
          { accountId: expenseAccount.id, debit: data.amount, credit: 0, description: data.category },
          { accountId: cashAccount.id, debit: 0, credit: data.amount },
        ],
      })

      result = { success: true, message: `✅ تم تسجيل المصروف في القيد ${journal.number}`, type: "expense" }

      await prisma.pendingTransaction.update({
        where: { id: pendingId },
        data: { status: "POSTED", confirmedAt: new Date(), confirmedBy, journalId: journal.id },
      })
    } else {
      result = { success: false, message: `⚠️ لم أستطع تحديد الحسابات المناسبة. راجع النظام يدوياً.`, type: "unknown" }

      await prisma.pendingTransaction.update({
        where: { id: pendingId },
        data: { status: "FAILED", confirmedAt: new Date(), confirmedBy },
      })
    }
  } catch (err: any) {
    console.error("processConfirmation error:", err)
    result = { success: false, message: `❌ فشل التسجيل: ${err.message}`, type: "error" }
    await prisma.pendingTransaction.update({
      where: { id: pendingId },
      data: { status: "FAILED" },
    })
  }

  return result
}
