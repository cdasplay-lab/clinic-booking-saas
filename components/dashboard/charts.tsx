"use client"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]

const monthlyData = [
  { month: "يناير", revenue: 45000, expenses: 32000 },
  { month: "فبراير", revenue: 52000, expenses: 38000 },
  { month: "مارس", revenue: 61000, expenses: 41000 },
  { month: "أبريل", revenue: 48000, expenses: 35000 },
  { month: "مايو", revenue: 72000, expenses: 45000 },
  { month: "يونيو", revenue: 68000, expenses: 42000 },
]

const expenseData = [
  { name: "رواتب", value: 45 },
  { name: "إيجار", value: 20 },
  { name: "تسويق", value: 15 },
  { name: "مواد", value: 12 },
  { name: "أخرى", value: 8 },
]

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">الإيرادات مقابل المصروفات (6 أشهر)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("ar-SA")} ريال`} />
            <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#3B82F6" fill="#EFF6FF" />
            <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#EF4444" fill="#FEF2F2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">توزيع المصروفات</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={expenseData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}%`}
            >
              {COLORS.map((color, i) => (
                <Cell key={i} fill={color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
