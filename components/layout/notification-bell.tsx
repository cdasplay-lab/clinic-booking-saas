"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Notification {
  id:        string
  type:      string
  title:     string
  body:      string
  href:      string | null
  isRead:    boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  INVOICE_OVERDUE:  "🔴",
  INVOICE_PAID:     "✅",
  PAYMENT_RECEIVED: "💚",
  PAYMENT_SENT:     "💸",
  QUOTE_ACCEPTED:   "🤝",
  QUOTE_CONVERTED:  "📄",
  BILL_DUE:         "⚠️",
  REMINDER_SENT:    "📧",
  IMPORT_DONE:      "📥",
  GENERAL:          "🔔",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "الآن"
  if (m < 60) return `منذ ${m} دقيقة`
  const h = Math.floor(m / 60)
  if (h < 24) return `منذ ${h} ساعة`
  const d = Math.floor(h / 24)
  return `منذ ${d} يوم`
}

export default function NotificationBell() {
  const [open, setOpen]             = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]       = useState(false)
  const [marking, setMarking]       = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }, [])

  // Initial load + poll every 60 seconds
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refresh on window focus
  useEffect(() => {
    const onFocus = () => fetchNotifications()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
  }

  async function markAllRead() {
    setMarking(true)
    await fetch("/api/notifications/read-all", { method: "POST" })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    setMarking(false)
  }

  async function handleOpen() {
    setOpen((o) => !o)
    if (!open) {
      setLoading(true)
      await fetchNotifications()
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef} dir="rtl">
      <Button variant="ghost" size="icon" onClick={handleOpen} className="relative">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl border shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold text-sm text-gray-800">
              الإشعارات
              {unreadCount > 0 && (
                <span className="mr-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                  {unreadCount} جديد
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600" onClick={markAllRead} disabled={marking}>
                {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCheck className="h-3 w-3 ml-1" />قراءة الكل</>}
              </Button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                >
                  <span className="text-lg mt-0.5 shrink-0">{TYPE_ICON[n.type] || "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {n.href && (
                      <Link href={n.href} onClick={() => { markRead(n.id); setOpen(false) }}>
                        <ExternalLink className="h-3.5 w-3.5 text-blue-500 hover:text-blue-700" />
                      </Link>
                    )}
                    {!n.isRead && (
                      <button onClick={() => markRead(n.id)} title="تعيين كمقروء">
                        <Check className="h-3.5 w-3.5 text-gray-400 hover:text-green-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 bg-gray-50 text-center">
              <p className="text-xs text-gray-400">آخر 50 إشعار</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
