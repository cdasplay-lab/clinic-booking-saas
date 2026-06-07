"use client"
import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

export default function PwaRegister() {
  const [installable, setInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[PWA] Service worker registered", reg.scope))
        .catch((err) => console.warn("[PWA] SW registration failed", err))
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setInstallable(true)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setInstallable(false)
    setDeferredPrompt(null)
    if (outcome === "accepted") {
      console.log("[PWA] User accepted install")
    }
  }

  if (!installable || dismissed) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="bg-white border border-blue-200 shadow-xl rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">HP</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">ثبّت HesabPro</p>
          <p className="text-xs text-gray-500">للوصول السريع من الشاشة الرئيسية</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={install}
            className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            <Download className="h-3.5 w-3.5" />
            تثبيت
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
