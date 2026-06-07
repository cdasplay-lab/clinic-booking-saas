"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ShieldCheck, ShieldOff, Loader2, Check, QrCode } from "lucide-react"

interface Props {
  enabled: boolean
}

export default function TwoFactorSettings({ enabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)

  // --- Setup flow ---
  const [setupOpen, setSetupOpen] = useState(false)
  const [setupStep, setSetupStep] = useState<"qr" | "verify" | "done">("qr")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [setupToken, setSetupToken] = useState("")
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState("")

  // --- Disable flow ---
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableToken, setDisableToken] = useState("")
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableError, setDisableError] = useState("")

  async function startSetup() {
    setSetupLoading(true)
    setSetupError("")
    try {
      const res = await fetch("/api/auth/2fa/setup")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQrDataUrl(data.qrDataUrl)
      setSecret(data.secret)
      setSetupToken("")
      setSetupStep("qr")
      setSetupOpen(true)
    } catch (err: any) {
      setSetupError(err.message || "حدث خطأ")
    } finally {
      setSetupLoading(false)
    }
  }

  async function verifySetup() {
    setSetupLoading(true)
    setSetupError("")
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: setupToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSetupStep("done")
      setEnabled(true)
    } catch (err: any) {
      setSetupError(err.message || "رمز غير صحيح")
    } finally {
      setSetupLoading(false)
    }
  }

  async function handleDisable() {
    setDisableLoading(true)
    setDisableError("")
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, token: disableToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEnabled(false)
      setDisableOpen(false)
      setDisablePassword("")
      setDisableToken("")
    } catch (err: any) {
      setDisableError(err.message || "حدث خطأ")
    } finally {
      setDisableLoading(false)
    }
  }

  function closeSetup() {
    setSetupOpen(false)
    setSetupStep("qr")
    setSetupToken("")
    setSetupError("")
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="font-medium text-sm">المصادقة الثنائية (2FA)</p>
        <p className="text-xs text-gray-500">
          {enabled
            ? "المصادقة الثنائية مفعّلة — حسابك محمي"
            : "أضف طبقة أمان إضافية لحسابك"}
        </p>
        {setupError && <p className="text-xs text-red-500 mt-1">{setupError}</p>}
      </div>

      <div className="flex items-center gap-2">
        {enabled ? (
          <>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
              <Check className="h-3 w-3" />مفعّلة
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="h-4 w-4 ml-1" />تعطيل
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={startSetup} disabled={setupLoading}>
            {setupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
            ) : (
              <ShieldCheck className="h-4 w-4 ml-1" />
            )}
            تفعيل 2FA
          </Button>
        )}
      </div>

      {/* ── Setup Dialog ── */}
      <Dialog open={setupOpen} onOpenChange={(o) => { if (!o) closeSetup() }}>
        <DialogContent className="max-w-md" dir="rtl">
          {setupStep === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />إعداد المصادقة الثنائية
                </DialogTitle>
                <DialogDescription>
                  امسح رمز QR باستخدام Google Authenticator أو Authy
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {qrDataUrl && (
                  <div className="flex justify-center">
                    <img
                      src={qrDataUrl}
                      alt="TOTP QR Code"
                      width={192}
                      height={192}
                      className="rounded-xl border p-2 bg-white"
                    />
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center space-y-1">
                  <p className="text-xs text-gray-500">أو أدخل الرمز يدوياً في التطبيق:</p>
                  <code className="text-xs font-mono break-all text-gray-800 select-all">
                    {secret}
                  </code>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setSetupStep("verify")} className="w-full">
                  التالي: تأكيد الرمز
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === "verify" && (
            <>
              <DialogHeader>
                <DialogTitle>تأكيد الرمز</DialogTitle>
                <DialogDescription>
                  أدخل الرمز المكوّن من 6 أرقام الذي يظهر في التطبيق
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {setupError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                    {setupError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>رمز المصادقة</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em] font-mono h-12"
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setSetupStep("qr"); setSetupError("") }}>
                  رجوع
                </Button>
                <Button
                  onClick={verifySetup}
                  disabled={setupLoading || setupToken.length !== 6}
                >
                  {setupLoading && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                  تفعيل
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === "done" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-green-700 flex items-center gap-2">
                  <Check className="h-5 w-5" />تم تفعيل المصادقة الثنائية
                </DialogTitle>
                <DialogDescription>
                  حسابك الآن محمي. ستُطلب منك كلمة المرور ورمز المصادقة عند كل تسجيل دخول.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={closeSetup} className="w-full">
                  إغلاق
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Disable Dialog ── */}
      <Dialog open={disableOpen} onOpenChange={(o) => { if (!o) { setDisableOpen(false); setDisableError("") } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldOff className="h-5 w-5" />تعطيل المصادقة الثنائية
            </DialogTitle>
            <DialogDescription>
              لتعطيل 2FA، أدخل كلمة مرورك ورمز المصادقة الحالي من التطبيق.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {disableError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {disableError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>كلمة المرور</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>رمز المصادقة الحالي</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em] font-mono h-12"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDisableOpen(false); setDisableError("") }}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableLoading || !disablePassword || disableToken.length !== 6}
            >
              {disableLoading && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تعطيل 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
