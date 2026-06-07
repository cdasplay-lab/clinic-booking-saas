"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Loader2 } from "lucide-react"

export default function TwoFactorChallengePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/2fa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "حدث خطأ، حاول مجدداً")
        setLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("حدث خطأ في الاتصال، حاول مجدداً")
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">التحقق الثنائي</CardTitle>
          <CardDescription>أدخل الرمز من تطبيق المصادقة (Google Authenticator أو Authy)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">رمز المصادقة (6 أرقام)</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-3xl tracking-[0.5em] font-mono h-14"
                autoFocus
                autoComplete="one-time-code"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                "تأكيد الدخول"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
