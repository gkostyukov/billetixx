import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

// GET all bills for authenticated user
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const bills = await prisma.bill.findMany({
      where: { userId: user.id },
      orderBy: { dueDate: 'asc' }
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error("GET bills error:", error)
    return errorResponse("Failed to fetch bills")
  }
}

// POST create new bill
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { title, amount, dueDate, status, category, description } = data

    if (!title || !amount || !dueDate) {
      return errorResponse("Title, amount, and due date are required", 400)
    }

    const bill = await prisma.bill.create({
      data: {
        title,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        status: status || "pending",
        category,
        description,
        userId: user.id,
      }
    })

    return NextResponse.json(bill, { status: 201 })
  } catch (error) {
    console.error("POST bill error:", error)
    return errorResponse("Failed to create bill")
  }
}

// PUT update bill
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, title, amount, dueDate, status, category, description } = data

    if (!id) {
      return errorResponse("Bill ID is required", 400)
    }

    // Verify ownership
    const existingBill = await prisma.bill.findUnique({
      where: { id }
    })

    if (!existingBill || existingBill.userId !== user.id) {
      return errorResponse("Bill not found", 404)
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(status && { status }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
      }
    })

    return NextResponse.json(bill)
  } catch (error) {
    console.error("PUT bill error:", error)
    return errorResponse("Failed to update bill")
  }
}

// DELETE bill
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return errorResponse("Bill ID is required", 400)
    }

    // Verify ownership
    const existingBill = await prisma.bill.findUnique({
      where: { id }
    })

    if (!existingBill || existingBill.userId !== user.id) {
      return errorResponse("Bill not found", 404)
    }

    await prisma.bill.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Bill deleted successfully" })
  } catch (error) {
    console.error("DELETE bill error:", error)
    return errorResponse("Failed to delete bill")
  }
}
