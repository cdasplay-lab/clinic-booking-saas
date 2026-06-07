"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"

interface MonthData {
  label: string
  inflow: number
  outflow: number
  net: number
}

interface Props {
  data: MonthData[]
  currency: string
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    notation: n > 999999 ? "compact" : "standard",
  }).format(Math.abs(n))
}

export default function CashFlowChart({ data, currency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => fmt(v, currency)}
          width={70}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            fmt(value, currency),
            name === "inflow" ? "تدفق داخل" : name === "outflow" ? "تدفق خارج" : "الصافي",
          ]}
          labelStyle={{ fontFamily: "Cairo, sans-serif" }}
        />
        <Legend
          formatter={(value) =>
            value === "inflow" ? "تدفق داخل" : value === "outflow" ? "تدفق خارج" : "الصافي"
          }
        />
        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
        <Bar dataKey="inflow"  fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Bar dataKey="outflow" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={40} />
        <Bar dataKey="net"     fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
