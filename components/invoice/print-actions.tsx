"use client"
import { Printer, ArrowRight, X } from "lucide-react"

interface PrintActionsProps {
  invoiceNumber: string
  backUrl: string
}

export default function PrintActions({ invoiceNumber, backUrl }: PrintActionsProps) {
  return (
    <div style={{
      background: "#1e40af",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          onClick={() => window.print()}
          style={{
            background: "white",
            color: "#1e40af",
            border: "none",
            borderRadius: "8px",
            padding: "8px 20px",
            fontFamily: "Cairo, sans-serif",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Printer size={16} />
          طباعة / تنزيل PDF
        </button>
        <span style={{ color: "#bfdbfe", fontSize: "13px" }}>
          اختر "حفظ كـ PDF" من نافذة الطباعة
        </span>
      </div>

      <a
        href={backUrl}
        style={{
          color: "#93c5fd",
          textDecoration: "none",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <X size={14} />
        إغلاق
      </a>
    </div>
  )
}
