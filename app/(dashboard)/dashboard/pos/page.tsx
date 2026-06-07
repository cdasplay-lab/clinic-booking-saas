"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  LogIn, LogOut, Loader2, CheckCircle2, BarChart3,
  RefreshCw
} from "lucide-react"
import Link from "next/link"

type Product = {
  id: string; code: string; name: string; barcode: string | null
  salePrice: number; unit: string; category: string | null; stock: number
}

type CartItem = Product & { qty: number; discount: number }

type PosSession = {
  id: string; number: string; openedAt: string
  totalSales: number; totalTransactions: number; status: string
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "نقدي", CARD: "بطاقة/شبكة", TRANSFER: "تحويل بنكي"
}

export default function PosPage() {
  const [session, setSession]         = useState<PosSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [openingBalance, setOpeningBalance] = useState("0")
  const [opening, setOpening]         = useState(false)

  const [products, setProducts]       = useState<Product[]>([])
  const [searchQ, setSearchQ]         = useState("")
  const [searching, setSearching]     = useState(false)
  const [cart, setCart]               = useState<CartItem[]>([])

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [payMethod, setPayMethod]     = useState<"CASH" | "CARD" | "TRANSFER">("CASH")
  const [amountPaid, setAmountPaid]   = useState("")
  const [processing, setProcessing]   = useState(false)
  const [receipt, setReceipt]         = useState<{ number: string; total: number; change: number } | null>(null)

  const [closingOpen, setClosingOpen] = useState(false)
  const [closingBalance, setClosingBalance] = useState("")
  const [closing, setClosing]         = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef("")
  const barcodeTimer = useRef<NodeJS.Timeout>()

  // Load current session on mount
  useEffect(() => {
    fetch("/api/pos/sessions")
      .then((r) => r.json())
      .then((data) => { setSession(data); setSessionLoading(false) })
      .catch(() => setSessionLoading(false))
  }, [])

  // Load products when no search query (show all)
  useEffect(() => {
    if (!session) return
    setSearching(true)
    fetch(`/api/pos/products${searchQ ? `?q=${encodeURIComponent(searchQ)}` : ""}`)
      .then((r) => r.json())
      .then((data) => { setProducts(Array.isArray(data) ? data : []); setSearching(false) })
      .catch(() => setSearching(false))
  }, [searchQ, session])

  // Barcode scanner: fast keypresses end with Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!session) return
      if (e.key === "Enter" && barcodeBuffer.current.length > 3) {
        const bc = barcodeBuffer.current
        barcodeBuffer.current = ""
        fetch(`/api/pos/products?barcode=${encodeURIComponent(bc)}`)
          .then((r) => r.json())
          .then((data: Product[]) => { if (data[0]) addToCart(data[0]) })
        return
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key
        clearTimeout(barcodeTimer.current)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = "" }, 100)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [session])

  const cartTotal = cart.reduce((s, i) => s + i.salePrice * i.qty - i.discount, 0)

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...product, qty: 1, discount: 0 }]
    })
  }, [])

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev
      .map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter((i) => i.qty > 0)
    )
  }

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id))

  async function openSession() {
    setOpening(true)
    const res = await fetch("/api/pos/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: Number(openingBalance) }),
    })
    const data = await res.json()
    if (res.ok) { setSession(data); setTimeout(() => searchRef.current?.focus(), 100) }
    setOpening(false)
  }

  async function checkout() {
    if (!session || cart.length === 0) return
    setProcessing(true)
    const paid = Number(amountPaid) || cartTotal
    const res = await fetch("/api/pos/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId:     session.id,
        paymentMethod: payMethod,
        amountPaid:    paid,
        items: cart.map((i) => ({
          productId: i.id,
          quantity:  i.qty,
          unitPrice: i.salePrice,
          discount:  i.discount,
        })),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setReceipt({ number: data.number, total: data.total, change: data.change })
      setCart([])
      setAmountPaid("")
      setCheckoutOpen(false)
      setSession((s) => s ? { ...s, totalSales: s.totalSales + data.total, totalTransactions: s.totalTransactions + 1 } : s)
    }
    setProcessing(false)
  }

  async function closeSession() {
    if (!session) return
    setClosing(true)
    await fetch(`/api/pos/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingBalance: Number(closingBalance) }),
    })
    setSession(null)
    setCart([])
    setClosingOpen(false)
    setClosing(false)
  }

  const change = Math.max(0, (Number(amountPaid) || 0) - cartTotal)

  // ── No session screen ──────────────────────────────────────
  if (sessionLoading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="text-center">
          <ShoppingCart className="h-16 w-16 text-blue-200 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">نقطة البيع</h1>
          <p className="text-gray-500 mt-1">افتح وردية جديدة للبدء</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-6 w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">رصيد الصندوق الافتتاحي</label>
            <Input type="number" min="0" step="0.01" value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="mt-1 text-lg text-center font-mono" placeholder="0.00" />
          </div>
          <Button className="w-full h-12 text-base" onClick={openSession} disabled={opening}>
            {opening ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="h-5 w-5 ml-2" />فتح وردية</>}
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard/pos/report"><BarChart3 className="h-4 w-4 ml-1" />تقرير اليوم</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── Receipt screen ─────────────────────────────────────────
  if (receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="bg-white rounded-xl border shadow-sm p-8 w-full max-w-sm text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-green-700">تم البيع بنجاح!</h2>
          <p className="font-mono text-gray-500 text-sm">{receipt.number}</p>
          <div className="border rounded-lg p-4 space-y-1 text-right">
            <div className="flex justify-between"><span className="text-gray-500">الإجمالي</span><span className="font-bold text-lg">{formatCurrency(receipt.total)}</span></div>
            {receipt.change > 0 && (
              <div className="flex justify-between text-green-600"><span>الباقي للعميل</span><span className="font-bold">{formatCurrency(receipt.change)}</span></div>
            )}
          </div>
          <Button className="w-full h-12 text-base" onClick={() => { setReceipt(null); setTimeout(() => searchRef.current?.focus(), 100) }}>
            <RefreshCw className="h-5 w-5 ml-2" />بيع جديد
          </Button>
        </div>
      </div>
    )
  }

  // ── Main POS screen ────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-0">
      {/* Session bar */}
      <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-mono font-bold">{session.number}</span>
          <span className="opacity-75">|</span>
          <span>مبيعات اليوم: <strong>{formatCurrency(session.totalSales)}</strong></span>
          <span className="opacity-75">|</span>
          <span>{session.totalTransactions} عملية</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-blue-700 h-7 text-xs" asChild>
            <Link href="/dashboard/pos/report"><BarChart3 className="h-3.5 w-3.5 ml-1" />التقرير</Link>
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-red-600 h-7 text-xs"
            onClick={() => setClosingOpen(true)}>
            <LogOut className="h-3.5 w-3.5 ml-1" />إغلاق الوردية
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden border border-t-0 rounded-b-lg bg-gray-50">
        {/* Products panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 bg-white border-b">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                ref={searchRef}
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="بحث بالاسم أو الكود أو الباركود..."
                className="pr-9 h-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {searching ? (
              <div className="flex justify-center pt-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : products.length === 0 ? (
              <div className="text-center pt-8 text-gray-400">لا توجد منتجات</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-white border rounded-lg p-3 text-right hover:border-blue-400 hover:bg-blue-50 active:scale-95 transition-all flex flex-col gap-1"
                  >
                    <p className="text-xs text-gray-400 font-mono">{p.code}</p>
                    <p className="text-sm font-medium leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-blue-600 font-bold text-sm mt-auto">{formatCurrency(p.salePrice)}</p>
                    {p.stock !== undefined && (
                      <p className={`text-xs ${p.stock <= 0 ? "text-red-400" : "text-gray-400"}`}>
                        مخزون: {p.stock} {p.unit}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-72 flex flex-col border-r bg-white">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-gray-500" />
            <span className="font-semibold">العربة</span>
            {cart.length > 0 && <Badge variant="secondary" className="mr-auto">{cart.length}</Badge>}
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <ShoppingCart className="h-10 w-10" />
                <p className="text-sm">العربة فارغة</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.id} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-medium leading-tight flex-1">{item.name}</p>
                      <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-400 mt-0.5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, -1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-100">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-mono w-6 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, +1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-gray-100">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-blue-600">
                        {formatCurrency(item.salePrice * item.qty)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>الإجمالي</span>
              <span className="text-blue-600">{formatCurrency(cartTotal)}</span>
            </div>
            {cart.length > 0 && (
              <Button className="w-full h-12 text-base font-bold" onClick={() => { setAmountPaid(cartTotal.toFixed(2)); setCheckoutOpen(true) }}>
                إتمام البيع
              </Button>
            )}
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full text-gray-400 h-7"
                onClick={() => setCart([])}>
                إفراغ العربة
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Checkout dialog ── */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">إتمام البيع</h2>

            <div className="border rounded-lg p-3 space-y-1 text-sm">
              {cart.map((i) => (
                <div key={i.id} className="flex justify-between text-gray-600">
                  <span>{i.name} × {i.qty}</span>
                  <span>{formatCurrency(i.salePrice * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>الإجمالي</span>
                <span className="text-blue-600">{formatCurrency(cartTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "CARD", "TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${payMethod === m ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}
                >
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">المبلغ المدفوع</label>
              <Input
                type="number"
                min={cartTotal}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="mt-1 text-lg text-center font-mono h-12"
                autoFocus
              />
            </div>

            {Number(amountPaid) > 0 && (
              <div className={`flex justify-between text-lg font-bold rounded-lg p-3 ${change > 0 ? "bg-green-50 text-green-700" : "bg-gray-50"}`}>
                <span>الباقي للعميل</span>
                <span>{formatCurrency(change)}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setCheckoutOpen(false)}>إلغاء</Button>
              <Button className="flex-1 h-11" onClick={checkout} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد البيع"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close session dialog ── */}
      {closingOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">إغلاق الوردية</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">الوردية</span><span className="font-mono">{session.number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">إجمالي المبيعات</span><span className="font-bold text-blue-600">{formatCurrency(session.totalSales)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">عدد العمليات</span><span>{session.totalTransactions}</span></div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">رصيد الصندوق الختامي</label>
              <Input type="number" min="0" step="0.01" value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="mt-1 text-lg text-center font-mono h-11" placeholder="0.00" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setClosingOpen(false)}>إلغاء</Button>
              <Button variant="destructive" className="flex-1" onClick={closeSession} disabled={closing}>
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : "إغلاق الوردية"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
