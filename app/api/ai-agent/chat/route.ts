import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runAIAgent } from "@/lib/ai-agent"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message, conversationId, organizationId } = await req.json()
  if (!message || !organizationId) return NextResponse.json({ error: "Message and organizationId required" }, { status: 400 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, organizationId },
    include: { organization: true },
  })
  if (!userOrg) return NextResponse.json({ error: "Access denied" }, { status: 403 })

  let convId = conversationId
  if (!convId) {
    const conv = await prisma.aIConversation.create({
      data: { organizationId, userId: session.user.id, title: message.slice(0, 50) },
    })
    convId = conv.id
  }

  await prisma.aIMessage.create({ data: { conversationId: convId, role: "USER", content: message } })

  const history = await prisma.aIMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  })

  const historyFormatted = history.slice(0, -1).map((m) => ({
    role: m.role === "USER" ? "user" as const : "assistant" as const,
    content: m.content,
  }))

  try {
    const response = await runAIAgent(message, organizationId, userOrg.organization.name, historyFormatted, userOrg.organization.country)

    await prisma.aIMessage.create({ data: { conversationId: convId, role: "ASSISTANT", content: response } })

    return NextResponse.json({ response, conversationId: convId })
  } catch (error: any) {
    console.error("AI Agent error:", error)
    const errorMsg = "عذراً، لم أستطع الاتصال بالمساعد الذكي. تأكد من إعداد ANTHROPIC_API_KEY."
    await prisma.aIMessage.create({ data: { conversationId: convId, role: "ASSISTANT", content: errorMsg } })
    return NextResponse.json({ response: errorMsg, conversationId: convId })
  }
}
