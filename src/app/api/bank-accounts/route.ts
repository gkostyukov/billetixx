
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const accounts = await prisma.bankAccount.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error("[ACCOUNTS_GET]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await req.json()
    const { name, bankName, accountLast4, cardLast4, active } = body

    if (!name || !accountLast4) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    const account = await prisma.bankAccount.create({
      data: {
        name,
        bankName,
        accountLast4,
        cardLast4,
        active: active ?? true,
        userId: session.user.id,
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error("[ACCOUNTS_POST]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await req.json()
    const { id, name, bankName, accountLast4, cardLast4, active } = body

    if (!id) {
      return new NextResponse("Missing ID", { status: 400 })
    }

    // Verify ownership
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { id },
    })

    if (!existingAccount || existingAccount.userId !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const account = await prisma.bankAccount.update({
      where: { id },
      data: {
        name,
        bankName,
        accountLast4,
        cardLast4,
        active,
      },
    })

    return NextResponse.json(account)
  } catch (error) {
    console.error("[ACCOUNTS_PUT]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return new NextResponse("Missing ID", { status: 400 })
    }

    // Verify ownership
    const existingAccount = await prisma.bankAccount.findUnique({
      where: { id },
    })

    if (!existingAccount || existingAccount.userId !== session.user.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    await prisma.bankAccount.delete({
      where: { id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[ACCOUNTS_DELETE]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}
