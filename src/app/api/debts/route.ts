import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const debts = await prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(debts)
  } catch (error) {
    console.error("GET debts error:", error)
    return errorResponse("Failed to fetch debts")
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { title, totalAmount, remainingAmount, interestRate, minimumPayment, dueDate, creditor, status } = data

    if (!title || !totalAmount || !remainingAmount) {
      return errorResponse("Title, total amount, and remaining amount are required", 400)
    }

    const debt = await prisma.debt.create({
      data: {
        title,
        totalAmount: parseFloat(totalAmount),
        remainingAmount: parseFloat(remainingAmount),
        interestRate: interestRate ? parseFloat(interestRate) : 0,
        minimumPayment: minimumPayment ? parseFloat(minimumPayment) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        creditor,
        status: status || "active",
        userId: user.id,
      }
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (error) {
    console.error("POST debt error:", error)
    return errorResponse("Failed to create debt")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Debt ID is required", 400)

    const existing = await prisma.debt.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Debt not found", 404)
    }

    const debt = await prisma.debt.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(debt)
  } catch (error) {
    console.error("PUT debt error:", error)
    return errorResponse("Failed to update debt")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Debt ID is required", 400)

    const existing = await prisma.debt.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Debt not found", 404)
    }

    await prisma.debt.delete({ where: { id } })
    return NextResponse.json({ message: "Debt deleted successfully" })
  } catch (error) {
    console.error("DELETE debt error:", error)
    return errorResponse("Failed to delete debt")
  }
}
