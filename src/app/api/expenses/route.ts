import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const expenses = await prisma.expense.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error("GET expenses error:", error)
    return errorResponse("Failed to fetch expenses")
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { title, amount, date, category, description, recurring } = data

    if (!title || !amount || !date || !category) {
      return errorResponse("Title, amount, date, and category are required", 400)
    }

    const expense = await prisma.expense.create({
      data: {
        title,
        amount: parseFloat(amount),
        date: new Date(date),
        category,
        description,
        recurring: recurring || false,
        userId: user.id,
      }
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("POST expense error:", error)
    return errorResponse("Failed to create expense")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Expense ID is required", 400)

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Expense not found", 404)
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(expense)
  } catch (error) {
    console.error("PUT expense error:", error)
    return errorResponse("Failed to update expense")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Expense ID is required", 400)

    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Expense not found", 404)
    }

    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ message: "Expense deleted successfully" })
  } catch (error) {
    console.error("DELETE expense error:", error)
    return errorResponse("Failed to delete expense")
  }
}
