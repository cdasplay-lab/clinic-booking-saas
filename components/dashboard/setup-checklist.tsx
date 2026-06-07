import { CheckCircle2, Circle, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface CheckItem {
  done:  boolean
  label: string
  href:  string
  cta:   string
}

interface Props {
  items: CheckItem[]
}

export function SetupChecklist({ items }: Props) {
  const doneCount  = items.filter((i) => i.done).length
  const totalCount = items.length
  const allDone    = doneCount === totalCount
  const progress   = Math.round((doneCount / totalCount) * 100)

  if (allDone) return null

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-blue-900">خطوات البدء</CardTitle>
          <span className="text-sm font-medium text-blue-600">{doneCount}/{totalCount}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
              item.done ? "opacity-50" : "hover:bg-blue-100/50"
            }`}
          >
            <div className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-blue-300 shrink-0" />
              )}
              <span className={`text-sm ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                {item.label}
              </span>
            </div>
            {!item.done && (
              <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 h-7 px-2 text-xs" asChild>
                <Link href={item.href}>
                  {item.cta} <ArrowLeft className="h-3 w-3 mr-1" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
