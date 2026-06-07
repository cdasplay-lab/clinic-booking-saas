"use client"
import { useState } from "react"
import { QrCode, ChevronDown, ChevronUp } from "lucide-react"

interface Props {
  invoiceId: string
  vatNumber?: string | null
}

export default function ZatcaQrDisplay({ invoiceId, vatNumber }: Props) {
  const [open, setOpen] = useState(false)

  if (!vatNumber) return null

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-green-800">
          <QrCode className="h-4 w-4" />
          <span className="text-sm font-medium">رمز ZATCA الضريبي</span>
          <span className="text-xs bg-green-200 text-green-700 px-1.5 py-0.5 rounded">فاتورة ضريبية</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-green-600" /> : <ChevronDown className="h-4 w-4 text-green-600" />}
      </button>

      {open && (
        <div className="p-4 bg-white flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/zatca/${invoiceId}`}
            alt="ZATCA QR Code"
            className="w-32 h-32 border rounded"
          />
          <div className="text-sm space-y-1">
            <p className="font-medium text-gray-700">رمز الاستجابة السريعة</p>
            <p className="text-xs text-gray-500">
              مستوفٍ لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA) — المرحلة الأولى
            </p>
            <p className="text-xs text-gray-500">الرقم الضريبي: <span className="font-mono">{vatNumber}</span></p>
            <a
              href={`/api/zatca/${invoiceId}?format=png`}
              download={`zatca-${invoiceId}.png`}
              className="text-xs text-blue-600 hover:underline inline-block mt-1"
            >
              تحميل PNG
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
