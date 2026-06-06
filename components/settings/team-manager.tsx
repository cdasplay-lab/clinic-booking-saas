"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS, canManage, canChangeRole, type OrgRole,
} from "@/lib/permissions"
import { UserPlus, Trash2, ChevronDown, Loader2, Copy, CheckCircle2, AlertCircle } from "lucide-react"

interface Member {
  id: string
  role: OrgRole
  createdAt: string
  user: { id: string; name: string; email: string }
}

const ASSIGNABLE_ROLES: OrgRole[] = ["ADMIN", "ACCOUNTANT", "MANAGER", "VIEWER"]

interface TeamManagerProps {
  members: Member[]
  currentUserId: string
  currentRole: OrgRole
}

export default function TeamManager({ members: initial, currentUserId, currentRole }: TeamManagerProps) {
  const [members, setMembers] = useState(initial)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<OrgRole>("ACCOUNTANT")
  const [loading, setLoading] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ message: string; tempPassword?: string } | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const canActOnUser = (m: Member) =>
    m.user.id !== currentUserId && canManage(currentRole, m.role)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInviteResult(null)
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }

    setInviteResult({ message: data.message, tempPassword: data.tempPassword })
    setInviteEmail("")
    setInviteName("")

    // Refresh list
    const listRes = await fetch("/api/team")
    if (listRes.ok) setMembers(await listRes.json())
    setLoading(false)
  }

  async function handleRoleChange(memberId: string, newRole: OrgRole) {
    const res = await fetch(`/api/team/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("هل أنت متأكد من إزالة هذا العضو؟")) return
    const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" })
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  function copyPassword(pw: string) {
    navigator.clipboard.writeText(pw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Current members table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-700">أعضاء الفريق ({members.length})</p>
        </div>
        <div className="divide-y">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {m.user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {m.user.name}
                    {m.user.id === currentUserId && (
                      <span className="mr-2 text-xs text-gray-400">(أنت)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{m.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {canActOnUser(m) && canChangeRole(currentRole, m.role) ? (
                  <div className="relative">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as OrgRole)}
                      className={`appearance-none text-xs font-medium px-3 py-1.5 rounded-full pr-7 cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 ${ROLE_COLORS[m.role]}`}
                    >
                      {ASSIGNABLE_ROLES.filter((r) => canChangeRole(currentRole, r)).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-1.5 top-1.5 h-3 w-3 pointer-events-none opacity-60" />
                  </div>
                ) : (
                  <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                    {ROLE_LABELS[m.role]}
                  </span>
                )}

                {canActOnUser(m) && (
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                    title="إزالة العضو"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ROLE_LABELS) as OrgRole[]).map((role) => (
          <div key={role} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
            <p className="text-xs text-gray-500">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      {/* Invite form — only for OWNER/ADMIN */}
      {["OWNER", "ADMIN"].includes(currentRole) && (
        <div className="border rounded-xl p-4 bg-blue-50 border-blue-100">
          <p className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> دعوة عضو جديد
          </p>

          {inviteResult && (
            <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {inviteResult.message}
              </p>
              {inviteResult.tempPassword && (
                <div className="mt-2 flex items-center gap-2">
                  <code className="bg-white px-3 py-1 rounded border text-sm font-mono font-bold text-gray-800">
                    {inviteResult.tempPassword}
                  </code>
                  <button
                    onClick={() => copyPassword(inviteResult.tempPassword!)}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <span className="text-xs text-gray-500">أرسل هذه كلمة المرور للمستخدم</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">البريد الإلكتروني *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@company.com"
                  required
                  dir="ltr"
                  className="bg-white text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الاسم (للمستخدمين الجدد)</Label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="أحمد محمد"
                  className="bg-white text-sm h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الدور</Label>
              <div className="relative w-48">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {ASSIGNABLE_ROLES.filter((r) => canChangeRole(currentRole, r)).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin ml-2" />}
              <UserPlus className="h-3.5 w-3.5 ml-2" />
              إضافة للفريق
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
