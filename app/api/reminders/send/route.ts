import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createTransport, buildReminderEmail } from "@/lib/email"
import { notifyInvoiceOverdue } from "@/lib/notify"

// Vercel Cron or manual trigger — protected by CRON_SECRET
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret")
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find all organizations that have reminders enabled
  const orgs = await prisma.organization.findMany({
    where: { reminderEnabled: true, isActive: true },
    select: { id: true, name: true, email: true, reminderDays: true },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const org of orgs) {
    // Parse configured reminder days (e.g. "1,7,14" → [1, 7, 14])
    const configuredDays = org.reminderDays
      .split(",")
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => !isNaN(d))

    // Find open/overdue invoices for this org with a contact email
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: org.id,
        type: "INVOICE",
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: today },
        contact: { email: { not: null } },
      },
      include: {
        contact: { select: { name: true, email: true } },
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://hesabpro.com"
    const transporter = createTransport()

    for (const inv of invoices) {
      try {
        const contactEmail = inv.contact.email
        if (!contactEmail) { skipped++; continue }

        const daysOverdue = Math.floor(
          (today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000
        )

        // Check if today's daysOverdue matches any configured reminder interval
        if (!configuredDays.includes(daysOverdue)) { skipped++; continue }

        // Avoid duplicate: already sent today
        if (inv.lastReminderAt) {
          const lastSent = new Date(inv.lastReminderAt)
          lastSent.setHours(0, 0, 0, 0)
          if (lastSent.getTime() === today.getTime()) { skipped++; continue }
        }

        const currency = inv.currency || "SAR"
        const amountDue = Number(inv.amountDue).toLocaleString("ar-SA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })

        const email = buildReminderEmail({
          invoiceNumber: inv.number,
          orgName: org.name,
          orgEmail: org.email || "",
          contactName: inv.contact.name,
          contactEmail,
          amountDue: `${amountDue} ${currency}`,
          dueDate: new Date(inv.dueDate).toLocaleDateString("ar-SA"),
          daysOverdue,
          invoiceUrl: `${appUrl}/dashboard/invoices/${inv.id}`,
        })

        await transporter.sendMail({
          from: `"${org.name}" <${process.env.SMTP_USER}>`,
          to: contactEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })

        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            lastReminderAt: new Date(),
            reminderCount: { increment: 1 },
          },
        })

        // Create in-app notification for the org
        notifyInvoiceOverdue(org.id, inv.number, inv.contact.name, inv.id).catch(() => {})

        sent++
      } catch (err: any) {
        errors.push(`invoice ${inv.id}: ${err.message}`)
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors,
    orgsChecked: orgs.length,
  })
}

// Allow manual trigger in dev
export async function GET(req: NextRequest) {
  return POST(req)
}
