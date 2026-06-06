import nodemailer from "nodemailer"

export function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

interface InvoiceEmailData {
  invoiceNumber: string
  invoiceTitle: string
  orgName: string
  orgEmail: string
  contactName: string
  contactEmail: string
  total: string
  dueDate: string
  invoiceUrl: string
  notes?: string | null
}

export function buildInvoiceEmail(data: InvoiceEmailData): { subject: string; html: string; text: string } {
  const subject = `${data.invoiceTitle} رقم ${data.invoiceNumber} من ${data.orgName}`

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f4f6f9; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; padding: 32px 36px; }
    .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 700; }
    .header p { margin: 0; color: #bfdbfe; font-size: 14px; }
    .body { padding: 32px 36px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 20px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-size: 14px; }
    .info-value { color: #1e293b; font-size: 14px; font-weight: 600; }
    .total-row .info-value { color: #2563eb; font-size: 18px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 16px; margin: 24px 0; }
    .notes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 20px; }
    .notes p { margin: 0; color: #92400e; font-size: 14px; }
    .footer { background: #f8fafc; padding: 20px 36px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${data.orgName}</h1>
      <p>${data.invoiceTitle} · ${data.invoiceNumber}</p>
    </div>
    <div class="body">
      <p class="greeting">السيد/ة <strong>${data.contactName}</strong>، السلام عليكم ورحمة الله وبركاته،</p>
      <p style="color:#475569;font-size:15px;">نرجو الاطلاع على الفاتورة المرفقة وإتمام الدفع قبل تاريخ الاستحقاق.</p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">رقم الفاتورة</span>
          <span class="info-value">${data.invoiceNumber}</span>
        </div>
        <div class="info-row total-row">
          <span class="info-label">المبلغ المستحق</span>
          <span class="info-value">${data.total}</span>
        </div>
        <div class="info-row">
          <span class="info-label">تاريخ الاستحقاق</span>
          <span class="info-value">${data.dueDate}</span>
        </div>
      </div>

      <div style="text-align:center;">
        <a href="${data.invoiceUrl}" class="btn">عرض الفاتورة</a>
      </div>

      ${data.notes ? `<div class="notes"><p><strong>ملاحظات:</strong> ${data.notes}</p></div>` : ""}

      <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
        في حال وجود أي استفسار، يرجى التواصل معنا على: <a href="mailto:${data.orgEmail}">${data.orgEmail}</a>
      </p>
    </div>
    <div class="footer">
      تم إرسال هذا البريد من نظام <strong>${data.orgName}</strong> المحاسبي
    </div>
  </div>
</body>
</html>`

  const text = `${data.invoiceTitle} رقم ${data.invoiceNumber} من ${data.orgName}

السيد/ة ${data.contactName}،

نرجو الاطلاع على الفاتورة رقم ${data.invoiceNumber}.

المبلغ المستحق: ${data.total}
تاريخ الاستحقاق: ${data.dueDate}

عرض الفاتورة: ${data.invoiceUrl}

${data.notes ? `ملاحظات: ${data.notes}` : ""}

للاستفسار: ${data.orgEmail}`

  return { subject, html, text }
}
