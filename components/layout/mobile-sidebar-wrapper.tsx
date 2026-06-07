"use client"
import { useState } from "react"
import Sidebar from "./sidebar"
import { Menu, X } from "lucide-react"

export default function MobileSidebarWrapper({ org }: { org: any }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button — only on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 right-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 right-0 z-50 transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative h-full">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 left-3 z-10 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
          <Sidebar org={org} onNavigate={() => setOpen(false)} />
        </div>
      </div>
    </>
  )
}
