import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const incomes = await prisma.income.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(incomes)
  } catch (error) {
    console.error("GET incomes error:", error)
    return errorResponse("Failed to fetch incomes")
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { title, amount, date, source, recurring, description } = data

    if (!title || !amount || !date || !source) {
      return errorResponse("Title, amount, date, and source are required", 400)
    }

    const income = await prisma.income.create({
      data: {
        title,
        amount: parseFloat(amount),
        date: new Date(date),
        source,
        recurring: recurring || false,
        description,
        userId: user.id,
      }
    })

    return NextResponse.json(income, { status: 201 })
  } catch (error) {
    console.error("POST income error:", error)
    return errorResponse("Failed to create income")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Income ID is required", 400)

    const existing = await prisma.income.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Income not found", 404)
    }

    const income = await prisma.income.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(income)
  } catch (error) {
    console.error("PUT income error:", error)
    return errorResponse("Failed to update income")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Income ID is required", 400)

    const existing = await prisma.income.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Income not found", 404)
    }

    await prisma.income.delete({ where: { id } })
    return NextResponse.json({ message: "Income deleted successfully" })
  } catch (error) {
    console.error("DELETE income error:", error)
    return errorResponse("Failed to delete income")
  }
}
