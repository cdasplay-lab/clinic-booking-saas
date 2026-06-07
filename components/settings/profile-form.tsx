"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertCircle, User, Lock } from "lucide-react"

interface Props {
  user: { id: string; name: string; email: string }
}

export default function ProfileForm({ user }: Props) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState("")

  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState("")

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError("")
    setProfileSaved(false)
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    })
    const data = await res.json()
    if (res.ok) {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    } else {
      setProfileError(data.error || "فشل الحفظ")
    }
    setProfileSaving(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwError("كلمتا المرور غير متطابقتين"); return }
    setPwSaving(true)
    setPwError("")
    setPwSaved(false)
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwSaved(true)
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
      setTimeout(() => setPwSaved(false), 3000)
    } else {
      setPwError(data.error || "فشل تغيير كلمة المرور")
    }
    setPwSaving(false)
  }

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {name.charAt(0) || "?"}
        </div>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
      </div>

      {/* Profile info */}
      <form onSubmit={saveProfile}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-blue-600" /> المعلومات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" /> {profileError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>الاسم الكامل</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={profileSaving}>
                {profileSaving && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
                حفظ
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> تم الحفظ
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Password change */}
      <form onSubmit={changePassword}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-red-600" /> تغيير كلمة المرور
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pwError && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4" /> {pwError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>كلمة المرور الحالية</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} autoComplete="new-password" />
              <p className="text-xs text-gray-400">8 أحرف على الأقل</p>
            </div>
            <div className="space-y-1.5">
              <Label>تأكيد كلمة المرور الجديدة</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" variant="outline" disabled={pwSaving || !currentPw || !newPw || !confirmPw}>
                {pwSaving && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
                تغيير كلمة المرور
              </Button>
              {pwSaved && (
                <span className="flex items-center gap-1.5 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> تم التغيير
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
