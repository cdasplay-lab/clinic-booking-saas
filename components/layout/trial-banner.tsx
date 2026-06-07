"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Zap, X } from "lucide-react"
import Link from "next/link"

interface Props {
  trialEndsAt: Date | null
  hasSubscription: boolean
}

export function TrialBanner({ trialEndsAt, hasSubscription }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || hasSubscription || !trialEndsAt) return null

  const now     = new Date()
  const msLeft  = new Date(trialEndsAt).getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  if (daysLeft <= 0) {
    // Trial expired — show urgent banner
    return (
      <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 shrink-0" />
          <span className="font-medium">انتهت فترتك التجريبية — اشترك الآن لمنع تقييد حسابك</span>
        </div>
        <Button size="sm" variant="secondary" className="h-7 text-xs shrink-0" asChild>
          <Link href="/dashboard/billing">اشترك الآن</Link>
        </Button>
      </div>
    )
  }

  const isUrgent = daysLeft <= 3
  const bg = isUrgent ? "bg-amber-500" : "bg-blue-600"

  return (
    <div className={`${bg} text-white px-4 py-2 flex items-center justify-between text-sm`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 shrink-0" />
        <span>
          {isUrgent ? "⚠️ " : ""}
          <span className="font-medium">
            {daysLeft === 1
              ? "يوم واحد متبقٍ في تجربتك المجانية"
              : `${daysLeft} أيام متبقية في تجربتك المجانية`}
          </span>
          <span className="opacity-80 mr-1"> — تجربة احترافية مجانية لمدة 14 يوماً</span>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="secondary" className="h-7 text-xs" asChild>
          <Link href="/dashboard/billing">اشترك الآن</Link>
        </Button>
        <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
