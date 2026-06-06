import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractTransactionFromMessage, buildVerificationMessage, sendWhatsAppMessage, processConfirmation } from "@/lib/whatsapp"

// Webhook verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// Receive messages (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Extract message from WhatsApp webhook payload
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: "no_messages" })
    }

    const phoneNumberId = value?.metadata?.phone_number_id

    for (const message of messages) {
      const from = message.from
      const messageText = message.text?.body || message.body || ""
      const senderName = value?.contacts?.[0]?.profile?.name || "مستخدم"

      if (!messageText) continue

      // Find organization by WhatsApp phone number ID
      const whatsappInt = await prisma.whatsAppIntegration.findFirst({
        where: { phoneNumberId, isActive: true },
        include: { organization: { include: { accounts: true } } },
      })

      if (!whatsappInt) continue

      const orgId = whatsappInt.organizationId

      // Check if this is a confirmation/rejection response
      const confirmMatch = messageText.match(/تأكيد\s+([a-zA-Z0-9]{6})/i)
      const rejectMatch = messageText.match(/رفض\s+([a-zA-Z0-9]{6})/i)

      if (confirmMatch || rejectMatch) {
        const shortId = (confirmMatch || rejectMatch)?.[1]?.toLowerCase()

        // Find the pending transaction by short ID (last 6 chars)
        const pending = await prisma.pendingTransaction.findFirst({
          where: {
            organizationId: orgId,
            status: "WAITING",
            id: { endsWith: shortId || "" },
          },
        })

        if (!pending) {
          await sendWhatsAppMessage(
            phoneNumberId,
            whatsappInt.accessToken,
            from,
            "⚠️ لم أجد العملية المطلوبة. ربما تم تأكيدها مسبقاً أو انتهت صلاحيتها."
          )
          continue
        }

        if (rejectMatch) {
          await prisma.pendingTransaction.update({
            where: { id: pending.id },
            data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: "رُفض من واتساب" },
          })
          await sendWhatsAppMessage(
            phoneNumberId,
            whatsappInt.accessToken,
            from,
            "❌ تم رفض العملية وإلغاؤها."
          )
          continue
        }

        // Confirm and post
        const result = await processConfirmation(pending.id, senderName)
        await sendWhatsAppMessage(
          phoneNumberId,
          whatsappInt.accessToken,
          from,
          result?.message || "✅ تم تسجيل العملية في HesabPro"
        )
        continue
      }

      // Process new financial message
      const orgContext = `شركة ${whatsappInt.organization.name}، العملة: ريال سعودي`
      const extracted = await extractTransactionFromMessage(messageText, orgContext)

      if (!extracted) {
        // Not a financial message, ignore
        continue
      }

      // Create pending transaction
      const pending = await prisma.pendingTransaction.create({
        data: {
          organizationId: orgId,
          whatsappIntId: whatsappInt.id,
          messageId: message.id,
          senderPhone: from,
          senderName,
          originalMessage: messageText,
          parsedData: extracted,
          status: "WAITING",
          confirmationSentAt: new Date(),
        },
      })

      // Send verification message
      const verificationMsg = buildVerificationMessage({ ...extracted, pendingId: pending.id })

      await sendWhatsAppMessage(
        phoneNumberId,
        whatsappInt.accessToken,
        from,
        verificationMsg
      )
    }

    return NextResponse.json({ status: "ok" })
  } catch (error) {
    console.error("WhatsApp webhook error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
