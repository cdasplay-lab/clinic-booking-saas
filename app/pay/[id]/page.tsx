import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { getCountry } from "@/lib/countries"
import { formatCurrency } from "@/lib/utils"
import { CheckCircle2, AlertCircle, BookOpen, XCircle } from "lucide-react"
import { PayButton } from "./pay-button"

const STRIPE_CURRENCIES = new Set(["SAR", "AED", "KWD", "QAR", "BHD", "OMR", "USD", "EUR", "GBP", "EGP"])

export default async function PublicPayPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { success?: string; cancelled?: string }
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      contact:      true,
      items:        { include: { taxRate: true }, orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true, address: true, phone: true, email: true, taxNumber: true, country: true, logo: true } },
    },
  })

  if (!invoice) notFound()
  if (["CANCELLED", "DRAFT"].includes(invoice.status) && !searchParams.success) notFound()

  const org     = invoice.organization
  const country = getCountry(org.country)
  const fmt     = (n: number) => formatCurrency(n, country.currency, country.locale)
  const isPaid  = invoice.status === "PAID" || Number(invoice.amountDue) <= 0
  const canPayOnline = STRIPE_CURRENCIES.has(country.currency.toUpperCase())
  const invoiceTitle = country.vatEnabled ? "فاتورة ضريبية" : "فاتورة"
  const hasVat = country.vatEnabled && Number(invoice.taxAmount) > 0

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <span className="font-bold text-blue-600">HesabPro</span>
        <span className="text-gray-300 mx-2">|</span>
        <span className="text-gray-600 text-sm">{org.name}</span>
      </div>

      <div className="max-w-2xl mx-auto p-4 py-8 space-y-4">

        {/* Success banner */}
        {searchParams.success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <div>
              <p className="font-bold">تمّت عملية الدفع بنجاح! 🎉</p>
              <p className="text-sm mt-0.5">شكراً لك. سيصلك إيصال على بريدك الإلكتروني.</p>
            </div>
          </div>
        )}

        {/* Cancelled banner */}
        {searchParams.cancelled && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <p className="text-sm">تم إلغاء عملية الدفع. يمكنك المحاولة مجدداً أدناه.</p>
          </div>
        )}

        {/* Invoice card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{org.name}</h1>
                {org.address   && <p className="text-blue-200 text-sm">{org.address}</p>}
                {org.taxNumber && <p className="text-blue-200 text-sm">الرقم الضريبي: {org.taxNumber}</p>}
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold">{invoiceTitle}</p>
                <p className="text-blue-200 font-mono">{invoice.number}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Parties */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-gray-400 mb-1">فاتورة إلى</p>
                <p className="font-bold text-gray-900">{invoice.contact.name}</p>
                {invoice.contact.email && <p className="text-sm text-gray-500">{invoice.contact.email}</p>}
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-400">تاريخ الفاتورة</div>
                <div className="text-sm font-medium">{new Date(invoice.date).toLocaleDateString("ar-SA")}</div>
                <div className="text-xs text-gray-400 mt-1">تاريخ الاستحقاق</div>
                <div className="text-sm font-medium">{new Date(invoice.dueDate).toLocaleDateString("ar-SA")}</div>
              </div>
            </div>

            {/* Items */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">الوصف</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">الكمية</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">السعر</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 text-gray-800">{item.description}</td>
                      <td className="px-3 py-2 text-left text-gray-600">{Number(item.quantity).toFixed(2)}</td>
                      <td className="px-3 py-2 text-left text-gray-600">{fmt(Number(item.unitPrice))}</td>
                      <td className="px-3 py-2 text-left font-medium">{fmt(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 border-t pt-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>المجموع الفرعي</span>
                <span>{fmt(Number(invoice.subtotal))}</span>
              </div>
              {hasVat && (
                <div className="flex justify-between text-sm text-amber-700">
                  <span>{country.vatName}</span>
                  <span>{fmt(Number(invoice.taxAmount))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-blue-700 border-t pt-2 mt-2">
                <span>الإجمالي النهائي</span>
                <span>{fmt(Number(invoice.total))}</span>
              </div>
              {Number(invoice.amountPaid) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>المبلغ المدفوع</span>
                    <span>{fmt(Number(invoice.amountPaid))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600 border-t pt-1">
                    <span>المبلغ المستحق</span>
                    <span>{fmt(Number(invoice.amountDue))}</span>
                  </div>
                </>
              )}
            </div>

            {invoice.notes && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <span className="font-medium text-gray-700">ملاحظات: </span>{invoice.notes}
              </div>
            )}
          </div>
        </div>

        {/* Payment section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {isPaid || searchParams.success ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-bold text-lg text-green-700">هذه الفاتورة مدفوعة بالكامل</p>
              <p className="text-sm text-gray-500">شكراً لك!</p>
            </div>
          ) : !canPayOnline ? (
            <div className="text-center space-y-3">
              <XCircle className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-gray-500 text-sm">الدفع الإلكتروني غير متاح لعملة {country.currencySymbol} حالياً</p>
              {org.phone && (
                <p className="text-sm text-gray-600">
                  للدفع يدوياً، تواصل معنا: <span className="font-medium text-blue-600" dir="ltr">{org.phone}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{fmt(Number(invoice.amountDue))}</p>
                <p className="text-sm text-gray-500">المبلغ المستحق</p>
              </div>
              <PayButton invoiceId={invoice.id} label="ادفع الآن بالبطاقة الائتمانية" />
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                🔒 الدفع آمن ومشفر عبر Stripe
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
