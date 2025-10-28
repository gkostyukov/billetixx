import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { paymentDate: 'desc' }
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("GET payments error:", error)
    return errorResponse("Failed to fetch payments")
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { title, amount, paymentDate, method, category, description } = data

    if (!title || !amount || !paymentDate || !method) {
      return errorResponse("Title, amount, payment date, and method are required", 400)
    }

    const payment = await prisma.payment.create({
      data: {
        title,
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate),
        method,
        category,
        description,
        userId: user.id,
      }
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("POST payment error:", error)
    return errorResponse("Failed to create payment")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Payment ID is required", 400)

    const existing = await prisma.payment.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Payment not found", 404)
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("PUT payment error:", error)
    return errorResponse("Failed to update payment")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Payment ID is required", 400)

    const existing = await prisma.payment.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Payment not found", 404)
    }

    await prisma.payment.delete({ where: { id } })
    return NextResponse.json({ message: "Payment deleted successfully" })
  } catch (error) {
    console.error("DELETE payment error:", error)
    return errorResponse("Failed to delete payment")
  }
}
