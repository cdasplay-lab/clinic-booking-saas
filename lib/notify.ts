import { prisma } from "@/lib/prisma"

export type NotificationType =
  | "INVOICE_OVERDUE"
  | "INVOICE_PAID"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_SENT"
  | "QUOTE_ACCEPTED"
  | "QUOTE_CONVERTED"
  | "BILL_DUE"
  | "REMINDER_SENT"
  | "IMPORT_DONE"
  | "GENERAL"

interface NotifyOptions {
  organizationId: string
  userId?:        string   // target specific user; omit for org-wide
  type:           NotificationType
  title:          string
  body:           string
  href?:          string
}

export async function createNotification(opts: NotifyOptions): Promise<void> {
  await prisma.notification.create({
    data: {
      organizationId: opts.organizationId,
      userId:         opts.userId || null,
      type:           opts.type,
      title:          opts.title,
      body:           opts.body,
      href:           opts.href || null,
    },
  })
}

// Helpers for common events

export async function notifyInvoiceOverdue(
  orgId: string, invoiceNumber: string, contactName: string, invoiceId: string
) {
  await createNotification({
    organizationId: orgId,
    type:  "INVOICE_OVERDUE",
    title: `فاتورة متأخرة — ${invoiceNumber}`,
    body:  `فاتورة ${invoiceNumber} للعميل ${contactName} متأخرة عن موعد السداد`,
    href:  `/dashboard/invoices/${invoiceId}`,
  })
}

export async function notifyPaymentReceived(
  orgId: string, amount: string, contactName: string, paymentId: string
) {
  await createNotification({
    organizationId: orgId,
    type:  "PAYMENT_RECEIVED",
    title: `تم استلام دفعة — ${amount}`,
    body:  `تم تسجيل دفعة من ${contactName} بقيمة ${amount}`,
    href:  `/dashboard/payments`,
  })
}

export async function notifyPaymentSent(
  orgId: string, amount: string, contactName: string
) {
  await createNotification({
    organizationId: orgId,
    type:  "PAYMENT_SENT",
    title: `تم إرسال دفعة — ${amount}`,
    body:  `تم تسجيل دفعة للمورد ${contactName} بقيمة ${amount}`,
    href:  `/dashboard/payments`,
  })
}

export async function notifyQuoteConverted(
  orgId: string, quoteNumber: string, invoiceNumber: string, invoiceId: string
) {
  await createNotification({
    organizationId: orgId,
    type:  "QUOTE_CONVERTED",
    title: `عرض سعر محوّل — ${quoteNumber}`,
    body:  `تم تحويل عرض السعر ${quoteNumber} إلى الفاتورة ${invoiceNumber}`,
    href:  `/dashboard/invoices/${invoiceId}`,
  })
}
