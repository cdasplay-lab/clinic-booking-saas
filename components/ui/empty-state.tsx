import { Button } from "@/components/ui/button"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"

interface Props {
  icon:        LucideIcon
  title:       string
  description: string
  href?:       string
  ctaLabel?:   string
  secondaryHref?:  string
  secondaryLabel?: string
}

export function EmptyState({ icon: Icon, title, description, href, ctaLabel, secondaryHref, secondaryLabel }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">{description}</p>
      {(href || secondaryHref) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {href && ctaLabel && (
            <Button asChild>
              <Link href={href}>{ctaLabel}</Link>
            </Button>
          )}
          {secondaryHref && secondaryLabel && (
            <Button variant="outline" asChild>
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
