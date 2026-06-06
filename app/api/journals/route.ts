import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJournalEntry } from "@/lib/accounting"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json([], { status: 200 })

  const journals = await prisma.journal.findMany({
    where: { organizationId: userOrg.organizationId },
    include: { lines: { include: { account: true } } },
    orderBy: { date: "desc" },
  })

  return NextResponse.json(journals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userOrg = await prisma.userOrganization.findFirst({
    where: { userId: session.user.id, isDefault: true },
  })
  if (!userOrg) return NextResponse.json({ error: "No organization" }, { status: 400 })

  const body = await req.json()
  const { date, description, reference, lines } = body

  if (!date || !description || !lines?.length) {
    return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 })
  }

  const journalLines = lines.map((l: any) => ({
    accountId: l.accountId,
    debit: parseFloat(l.debit) || 0,
    credit: parseFloat(l.credit) || 0,
    description: l.description,
  }))

  try {
    const journal = await createJournalEntry({
      organizationId: userOrg.organizationId,
      date: new Date(date),
      type: "GENERAL",
      description,
      reference,
      lines: journalLines,
    })

    return NextResponse.json(journal, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
