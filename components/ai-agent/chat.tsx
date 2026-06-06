"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Bot, User, Send, Loader2, TrendingUp, FileText, Calculator, AlertTriangle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const QUICK_ACTIONS = [
  { icon: TrendingUp, label: "ما هو صافي الربح هذا الشهر؟", color: "text-green-600" },
  { icon: FileText, label: "أعطني ميزان المراجعة", color: "text-blue-600" },
  { icon: AlertTriangle, label: "أي الفواتير المتأخرة؟", color: "text-orange-600" },
  { icon: Calculator, label: "احسب ضريبة القيمة المضافة هذا الربع", color: "text-purple-600" },
]

export default function AIAgentChat({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `مرحباً! أنا مساعدك المحاسبي الذكي المدعوم بالذكاء الاصطناعي.

يمكنني مساعدتك في:
• **تحليل البيانات المالية** - أرباح، خسائر، تدفق نقدي
• **إنشاء التقارير** - ميزانية عمومية، أرباح وخسائر، ميزان مراجعة
• **تتبع الفواتير** - المتأخرة، المستحقة، الإجماليات
• **تحليل المصروفات** - أكبر بنود الإنفاق، الاتجاهات
• **التوصيات المالية** - نصائح لتحسين الوضع المالي
• **إدخال القيود** - بلغتك الطبيعية
• **الاستفسارات الضريبية** - حساب ضريبة القيمة المضافة

ماذا تريد أن تعرف؟`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage(text?: string) {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          conversationId,
          organizationId,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "حدث خطأ")

      if (data.conversationId) setConversationId(data.conversationId)

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `عذراً، حدث خطأ: ${err.message}. يرجى المحاولة مجدداً.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function renderContent(content: string) {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>")
      .replace(/• /g, "• ")
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Quick Actions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="text-sm"
            onClick={() => sendMessage(action.label)}
          >
            <action.icon className={cn("h-3.5 w-3.5 ml-1", action.color)} />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              msg.role === "assistant" ? "bg-blue-100" : "bg-gray-100"
            )}>
              {msg.role === "assistant" ? (
                <Bot className="h-4 w-4 text-blue-600" />
              ) : (
                <User className="h-4 w-4 text-gray-600" />
              )}
            </div>

            <div className={cn(
              "max-w-[75%] rounded-2xl px-4 py-3 text-sm",
              msg.role === "assistant"
                ? "bg-white border border-gray-200 text-gray-800"
                : "bg-blue-600 text-white"
            )}>
              <div
                dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                className="leading-relaxed"
              />
              <div className={cn(
                "text-xs mt-1 opacity-60",
                msg.role === "user" ? "text-blue-100" : "text-gray-400"
              )}>
                {msg.timestamp.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="h-4 w-4 text-blue-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اسألني أي شيء عن حسابات شركتك... (Enter للإرسال)"
          rows={2}
          className="resize-none"
          disabled={loading}
        />
        <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon" className="h-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
