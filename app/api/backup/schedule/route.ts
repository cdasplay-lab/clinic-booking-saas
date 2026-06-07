import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { fullBackupXlsx } from "@/lib/excel"
import { createTransport } from "@/lib/email"

// Cron job: weekly backup email — protected by CRON_SECRET
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const orgs = await prisma.organization.findMany({
    where: { backupEnabled: true, isActive: true },
    select: { id: true, name: true, email: true, backupEmail: true, country: true },
  })

  let sent = 0
  const errors: string[] = []

  for (const org of orgs) {
    try {
      const recipient = org.backupEmail || org.email
      if (!recipient) continue

      const [invoices, bills, payments, contacts, products, accounts, journals] = await Promise.all([
        prisma.invoice.findMany({ where: { organizationId: org.id }, include: { contact: { select: { name: true } } }, orderBy: { date: "desc" } }),
        prisma.bill.findMany({ where: { organizationId: org.id }, include: { contact: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
        prisma.payment.findMany({ where: { organizationId: org.id }, include: { contact: { select: { name: true } } }, orderBy: { date: "desc" } }),
        prisma.contact.findMany({ where: { organizationId: org.id }, orderBy: { name: "asc" } }),
        prisma.product.findMany({ where: { organizationId: org.id }, orderBy: { name: "asc" } }),
        prisma.account.findMany({ where: { organizationId: org.id }, orderBy: { code: "asc" } }),
        prisma.journal.findMany({ where: { organizationId: org.id }, orderBy: { date: "desc" }, take: 5000 }),
      ])

      const buf = Buffer.from(fullBackupXlsx({ org, invoices, bills, payments, contacts, products, accounts, journals }))

      const dateStr    = new Date().toLocaleDateString("ar-SA")
      const transporter = createTransport()

      await transporter.sendMail({
        from:    `"${org.name}" <${process.env.SMTP_USER}>`,
        to:      recipient,
        subject: `نسخة احتياطية أسبوعية — ${org.name} — ${dateStr}`,
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
            <h2>${org.name}</h2>
            <p>مرفق النسخة الاحتياطية الأسبوعية لبيانات نظام HesabPro بتاريخ ${dateStr}.</p>
            <p style="color:#6b7280;font-size:13px;">
              يحتوي الملف المرفق على: الفواتير، فواتير الموردين، المدفوعات، جهات الاتصال، المنتجات، دليل الحسابات، والقيود اليومية.
            </p>
          </div>`,
        text: `نسخة احتياطية أسبوعية — ${org.name} — ${dateStr}\n\nالملف المرفق يحتوي على بيانات النظام الكاملة.`,
        attachments: [{
          filename:    `نسخة_احتياطية_${org.name}_${new Date().toISOString().split("T")[0]}.xlsx`,
          content:     buf,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }],
      })

      sent++
    } catch (err: any) {
      errors.push(`${org.id}: ${err.message}`)
    }
  }

  return NextResponse.json({ sent, errors, orgsChecked: orgs.length })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
